/** DFY Content Pipeline Orchestrator. Single entry point for all DFY content generation.
 * Chains: transcript insert → process → autopilot (2×5) → blueprint completion → callback.
 * Constraint: Never called directly — triggered via webhook from mas-platform.
 */

import { task, tasks, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { fireDfyCallback } from '@/server/services/dfy-callback';
import type { processTranscript } from './process-transcript';
import type { runAutopilot } from './run-autopilot';
import type { completeBlueprintPostsTask } from './complete-blueprint-posts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DfyContentPipelinePayload {
  userId: string;
  engagementId: string;
  transcriptText?: string;
  blueprintProspectId?: string;
  clientName?: string;
  /** If provided, create/verify magnetlab account before running pipeline */
  clientEmail?: string;
  clientLinkedinUrl?: string;
  clientCompany?: string;
}

// ─── Task ───────────────────────────────────────────────────────────────────

export const dfyContentPipelineTask = task({
  id: 'dfy-content-pipeline',
  maxDuration: 900, // 15 min — orchestrator, sub-tasks have own timeouts
  retry: { maxAttempts: 1 },
  run: async (payload: DfyContentPipelinePayload) => {
    const {
      engagementId,
      transcriptText,
      blueprintProspectId,
      clientName,
      clientEmail,
      clientLinkedinUrl,
      clientCompany,
    } = payload;
    let { userId } = payload;
    const supabase = createSupabaseAdminClient();

    logger.info('Starting DFY content pipeline', {
      userId,
      engagementId,
      hasTranscript: !!transcriptText,
      hasBlueprintProspect: !!blueprintProspectId,
      clientName,
    });

    let transcriptId: string | null = null;
    let totalPosts = 0;
    const errors: string[] = [];

    // ─── Step 0: Ensure magnetlab account exists ─────────────────────────

    if (clientEmail) {
      try {
        const magnetlabUrl =
          process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://magnetlab.app';
        const apiKey = process.env.EXTERNAL_API_KEY;
        if (!apiKey) {
          logger.warn('EXTERNAL_API_KEY not set — skipping account creation');
        } else {
          const res = await fetch(`${magnetlabUrl}/api/external/create-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              email: clientEmail,
              full_name: clientName || clientEmail.split('@')[0],
              linkedin_url: clientLinkedinUrl,
              company: clientCompany,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const createdUserId = data.data?.user_id;
            if (createdUserId && !userId) {
              userId = createdUserId;
              logger.info('Created/verified magnetlab account', {
                userId: createdUserId,
                alreadyExisted: data.data?.already_existed,
              });
              // Update the engagement with the magnetlab_user_id
              await supabase
                .from('dfy_engagements')
                .update({ magnetlab_user_id: createdUserId })
                .eq('id', engagementId);
            }
          } else {
            const errText = await res.text().catch(() => 'unknown');
            logger.error('Failed to create magnetlab account', {
              status: res.status,
              error: errText,
            });
          }
        }
      } catch (err) {
        logger.error('Account creation failed — continuing with existing userId', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!userId) {
      throw new Error(
        'No userId available — cannot run content pipeline without a magnetlab account'
      );
    }

    // ─── Step 1: Insert transcript ──────────────────────────────────────

    if (transcriptText) {
      try {
        const externalId = `dfy:${engagementId}`;

        // Dedup check
        const { data: existing } = await supabase
          .from('cp_call_transcripts')
          .select('id')
          .eq('external_id', externalId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          transcriptId = existing.id;
          logger.info('Transcript already exists, skipping insert', { transcriptId, externalId });
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from('cp_call_transcripts')
            .insert({
              user_id: userId,
              source: 'dfy',
              external_id: externalId,
              title: clientName ? `Content Interview — ${clientName}` : 'DFY Content Interview',
              raw_transcript: transcriptText,
            })
            .select('id')
            .single();

          if (insertError || !inserted) {
            throw new Error(
              `Failed to insert transcript: ${insertError?.message ?? 'unknown error'}`
            );
          }

          transcriptId = inserted.id;
          logger.info('Transcript inserted', { transcriptId, externalId });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Step 1 failed: transcript insert', { error: msg });
        errors.push(`transcript_insert: ${msg}`);

        // Cannot continue without transcript
        await fireCallbackSafe(engagementId, 'failed', { error: msg, step: 'transcript_insert' });
        throw new Error(`Transcript insert failed: ${msg}`);
      }
    }

    // ─── Step 2: Process transcript ─────────────────────────────────────

    if (transcriptId) {
      try {
        logger.info('Step 2: Processing transcript', { transcriptId });

        const result = await tasks.triggerAndWait<typeof processTranscript>('process-transcript', {
          userId,
          transcriptId,
        });

        if (!result.ok) {
          throw new Error('process-transcript task failed');
        }

        logger.info('Transcript processed', {
          transcriptId,
          knowledgeEntries: result.output?.knowledgeEntries ?? 0,
          contentIdeas: result.output?.contentIdeas ?? 0,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Step 2 failed: transcript processing', { error: msg });
        errors.push(`transcript_processing: ${msg}`);

        // Cannot continue without processed transcript
        await fireCallbackSafe(engagementId, 'failed', {
          error: msg,
          step: 'transcript_processing',
        });
        throw new Error(`Transcript processing failed: ${msg}`);
      }
    }

    // ─── Step 3: Verify ideas exist ─────────────────────────────────────

    try {
      const { count } = await supabase
        .from('cp_content_ideas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'extracted');

      if (!count || count === 0) {
        throw new Error('No content ideas available after transcript processing');
      }

      logger.info('Content ideas verified', { count });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Step 3 failed: no content ideas', { error: msg });
      errors.push(`verify_ideas: ${msg}`);

      await fireCallbackSafe(engagementId, 'failed', { error: msg, step: 'verify_ideas' });
      throw new Error(`No content ideas: ${msg}`);
    }

    // ─── Step 4: Autopilot batch 1 ──────────────────────────────────────

    try {
      logger.info('Step 4: Autopilot batch 1 (5 posts)');

      const result = await tasks.triggerAndWait<typeof runAutopilot>('run-autopilot', {
        userId,
        postsPerBatch: 5,
        bufferTarget: 5,
        autoPublish: false,
      });

      if (result.ok) {
        totalPosts += result.output?.postsCreated ?? 0;
        logger.info('Autopilot batch 1 complete', {
          postsCreated: result.output?.postsCreated ?? 0,
        });
      } else {
        logger.error('Autopilot batch 1 failed');
        errors.push('autopilot_batch_1: task failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Step 4 failed: autopilot batch 1', { error: msg });
      errors.push(`autopilot_batch_1: ${msg}`);
      // Continue — try batch 2 and blueprint anyway
    }

    // ─── Step 5: Autopilot batch 2 ──────────────────────────────────────

    try {
      logger.info('Step 5: Autopilot batch 2 (5 posts)');

      const result = await tasks.triggerAndWait<typeof runAutopilot>('run-autopilot', {
        userId,
        postsPerBatch: 5,
        bufferTarget: 5,
        autoPublish: false,
      });

      if (result.ok) {
        totalPosts += result.output?.postsCreated ?? 0;
        logger.info('Autopilot batch 2 complete', {
          postsCreated: result.output?.postsCreated ?? 0,
        });
      } else {
        logger.error('Autopilot batch 2 failed');
        errors.push('autopilot_batch_2: task failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Step 5 failed: autopilot batch 2', { error: msg });
      errors.push(`autopilot_batch_2: ${msg}`);
      // Continue — try blueprint anyway
    }

    // ─── Step 6: Blueprint completion (conditional) ─────────────────────

    if (blueprintProspectId) {
      try {
        logger.info('Step 6: Blueprint completion', { prospectId: blueprintProspectId });

        const result = await tasks.triggerAndWait<typeof completeBlueprintPostsTask>(
          'complete-blueprint-posts',
          { userId, prospectId: blueprintProspectId, maxPosts: 15 }
        );

        if (result.ok) {
          totalPosts += result.output?.postsCompleted ?? 0;
          logger.info('Blueprint completion done', {
            postsCompleted: result.output?.postsCompleted ?? 0,
          });
        } else {
          logger.error('Blueprint completion task failed');
          errors.push('blueprint_completion: task failed');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Step 6 failed: blueprint completion', { error: msg });
        errors.push(`blueprint_completion: ${msg}`);
        // Continue — still fire callback with whatever we have
      }
    }

    // ─── Step 7: Count total posts ──────────────────────────────────────

    try {
      const { count } = await supabase
        .from('cp_pipeline_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      totalPosts = count ?? totalPosts;
      logger.info('Final post count', { totalPosts });
    } catch {
      logger.warn('Failed to count total posts, using accumulated count', { totalPosts });
    }

    // ─── Step 8: Fire callback ──────────────────────────────────────────

    const status = errors.length === 0 ? 'completed' : 'completed';
    // Even with partial failures, we report completed if we have posts
    await fireCallbackSafe(engagementId, status, {
      posts_created: totalPosts,
      magnetlab_user_id: userId,
      ...(errors.length > 0 && { warnings: errors }),
    });

    logger.info('DFY content pipeline complete', {
      engagementId,
      totalPosts,
      errors: errors.length,
    });

    return {
      engagementId,
      totalPosts,
      errors,
    };
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Fire DFY callback safely — never throws. */
async function fireCallbackSafe(
  engagementId: string,
  status: 'completed' | 'failed',
  result: Record<string, unknown>
): Promise<void> {
  try {
    await fireDfyCallback({
      engagement_id: engagementId,
      automation_type: 'content_calendar',
      status,
      result,
    });
  } catch (err) {
    logger.error('Failed to fire DFY callback', {
      engagementId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
