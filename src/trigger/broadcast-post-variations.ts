import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import Anthropic from '@anthropic-ai/sdk';
import { buildVoicePromptSection } from '@/lib/ai/content-pipeline/voice-prompt-builder';
import { randomUUID } from 'crypto';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

interface BroadcastInput {
  sourcePostId: string;
  targetProfileIds: string[];
  userId: string;
  staggerDays?: number; // Default 2
}

interface VariationResult {
  profileId: string;
  postId: string;
  scheduledTime: string | null;
}

export const broadcastPostVariations = task({
  id: 'broadcast-post-variations',
  maxDuration: 300, // 5 minutes — one AI call per profile
  retry: { maxAttempts: 2 },
  run: async (payload: BroadcastInput) => {
    const { sourcePostId, targetProfileIds, userId, staggerDays = 2 } = payload;
    const supabase = createSupabaseAdminClient();

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultHeaders: {
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
      },
      baseURL: process.env.HELICONE_API_KEY
        ? 'https://anthropic.helicone.ai/v1'
        : undefined,
    });

    logger.info('Starting broadcast post variations', {
      sourcePostId,
      targetProfileCount: targetProfileIds.length,
      userId,
      staggerDays,
    });

    // 1. Fetch source post
    const { data: sourcePost, error: postError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, idea_id, draft_content, final_content, status')
      .eq('id', sourcePostId)
      .eq('user_id', userId)
      .single();

    if (postError || !sourcePost) {
      throw new Error(`Source post not found: ${sourcePostId}`);
    }

    const sourceContent = sourcePost.final_content || sourcePost.draft_content;
    if (!sourceContent) {
      throw new Error('Source post has no content');
    }

    // 2. Fetch target profiles with voice_profile
    const { data: profiles, error: profilesError } = await supabase
      .from('team_profiles')
      .select('id, full_name, title, voice_profile, team_id')
      .in('id', targetProfileIds)
      .eq('status', 'active');

    if (profilesError || !profiles?.length) {
      throw new Error('No valid target profiles found');
    }

    // Verify all target profiles belong to the same team
    const teamIds = new Set(profiles.map(p => p.team_id));
    if (teamIds.size > 1) {
      throw new Error('Cannot broadcast to profiles from different teams');
    }

    // 3. Generate broadcast_group_id
    const broadcastGroupId = randomUUID();

    // 4. Mark source post with broadcast_group_id
    await supabase
      .from('cp_pipeline_posts')
      .update({ broadcast_group_id: broadcastGroupId })
      .eq('id', sourcePostId);

    // 5. Fetch posting slots for target profiles
    const { data: slots } = await supabase
      .from('cp_posting_slots')
      .select('id, user_id, day_of_week, time_of_day, team_profile_id, is_active')
      .in('team_profile_id', targetProfileIds)
      .eq('is_active', true);

    // 6. Generate variations for each profile
    const variations: VariationResult[] = [];
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];

      try {
        logger.info('Generating variation', {
          profileId: profile.id,
          profileName: profile.full_name,
          index: i,
        });

        // 6a. Build voice section
        const voiceSection = buildVoicePromptSection(
          profile.voice_profile as TeamVoiceProfile | null,
          'linkedin'
        );

        // 6b. Call Claude to rewrite in profile's voice
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `You are rewriting a LinkedIn post in a specific person's voice. Keep the core message and structure identical, but adapt the tone, vocabulary, and perspective to match this person.

${voiceSection}

AUTHOR: ${profile.full_name}, ${profile.title || 'Team Member'}

ORIGINAL POST:
${sourceContent}

Rewrite this post as ${profile.full_name}. Use first person from their perspective. Keep the same core insight and structure but make it sound authentically like them. Do NOT add any preamble or explanation — output ONLY the rewritten post.`,
            },
          ],
        });

        const rewrittenContent =
          response.content[0].type === 'text' ? response.content[0].text : '';

        if (!rewrittenContent) {
          logger.warn('Empty rewrite result', { profileId: profile.id });
          continue;
        }

        // 6c. Calculate stagger time
        // Spread across staggerDays days, starting tomorrow
        // Use profile's first active slot time
        const profileSlots = (slots || []).filter(
          (s) => s.team_profile_id === profile.id
        );
        const firstSlot = profileSlots[0];
        const slotTime = firstSlot?.time_of_day || '09:00';
        const [hours, minutes] = slotTime.split(':').map(Number);

        // Distribute across stagger days: profile i gets day (i % staggerDays)
        const dayOffset = i % staggerDays;
        const scheduledDate = new Date(tomorrow);
        scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
        scheduledDate.setHours(hours, minutes, 0, 0);

        const scheduledTime = scheduledDate.toISOString();

        // 6d. Insert new pipeline post
        const { data: newPost, error: insertError } = await supabase
          .from('cp_pipeline_posts')
          .insert({
            user_id: userId,
            team_profile_id: profile.id,
            draft_content: rewrittenContent,
            final_content: rewrittenContent,
            status: 'reviewing',
            scheduled_time: scheduledTime,
            broadcast_group_id: broadcastGroupId,
            is_buffer: false,
            idea_id: sourcePost.idea_id,
          })
          .select('id')
          .single();

        if (insertError) {
          logger.error('Failed to insert variation post', {
            profileId: profile.id,
            error: insertError.message,
          });
          continue;
        }

        variations.push({
          profileId: profile.id,
          postId: newPost.id,
          scheduledTime,
        });

        logger.info('Created variation', {
          profileId: profile.id,
          postId: newPost.id,
          scheduledTime,
        });
      } catch (profileError) {
        logger.error('Failed to generate variation for profile', {
          profileId: profile.id,
          error:
            profileError instanceof Error
              ? profileError.message
              : String(profileError),
        });
      }
    }

    logger.info('Broadcast complete', {
      broadcastGroupId,
      variationsCreated: variations.length,
      totalProfiles: profiles.length,
    });

    // 7. Return result
    return {
      broadcastGroupId,
      variations,
    };
  },
});
