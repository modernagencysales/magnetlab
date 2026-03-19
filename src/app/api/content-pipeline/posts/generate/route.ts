/**
 * Content Pipeline — Generate Post Route
 * POST /api/content-pipeline/posts/generate
 * Accepts any combination of content primitives, generates a LinkedIn post via AI,
 * saves it as a draft in cp_pipeline_posts, and marks the creative as used.
 * Never contains business logic beyond orchestration; delegates to AI + DB layers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';
import { GeneratePostSchema } from '@/lib/validations/exploits';
import { formatZodError } from '@/lib/validations/api';
import { generateFromPrimitives } from '@/lib/ai/content-pipeline/primitives-assembler';
import type { PrimitivesInput } from '@/lib/ai/content-pipeline/primitives-assembler';

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth check ──────────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Validate body ───────────────────────────────────────────────────
    const rawBody = await request.json();
    const parsed = GeneratePostSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const {
      exploit_id,
      creative_id,
      knowledge_ids,
      template_id,
      idea_id,
      style_id,
      hook,
      instructions,
    } = parsed.data;

    // ── 3. Data scope ──────────────────────────────────────────────────────
    const scope = await getDataScope(session.user.id);
    const userId = scope.userId;

    const { createSupabaseAdminClient } = await import('@/lib/utils/supabase-server');
    const supabase = createSupabaseAdminClient();

    // ── 4. Fetch each primitive from DB ────────────────────────────────────
    const primitives: PrimitivesInput = {};

    if (exploit_id) {
      const { data: exploit } = await supabase
        .from('cp_exploits')
        .select('name, prompt_template, example_posts')
        .eq('id', exploit_id)
        .single();
      if (exploit) {
        primitives.exploit = {
          name: exploit.name,
          prompt_template: exploit.prompt_template,
          example_posts: exploit.example_posts ?? [],
        };
      }
    }

    if (creative_id) {
      const { data: creative } = await supabase
        .from('cp_creatives')
        .select('content_text, image_url')
        .eq('id', creative_id)
        .eq('user_id', userId)
        .single();
      if (creative) {
        primitives.creative = {
          content_text: creative.content_text,
          image_url: creative.image_url ?? null,
        };
      }
    }

    if (knowledge_ids && knowledge_ids.length > 0) {
      const { data: entries } = await supabase
        .from('cp_knowledge_entries')
        .select('content')
        .in('id', knowledge_ids);
      if (entries && entries.length > 0) {
        primitives.knowledge = entries.map((e: { content: string }) => ({ content: e.content }));
      }
    }

    if (template_id) {
      const { data: template } = await supabase
        .from('cp_post_templates')
        .select('structure')
        .eq('id', template_id)
        .single();
      if (template) {
        primitives.template = { structure: template.structure };
      }
    }

    if (idea_id) {
      const { data: idea } = await supabase
        .from('cp_content_ideas')
        .select('core_insight, key_points')
        .eq('id', idea_id)
        .single();
      if (idea) {
        primitives.idea = {
          core_insight: idea.core_insight,
          key_points: idea.key_points ?? [],
        };
      }
    }

    if (style_id) {
      const { data: style } = await supabase
        .from('cp_writing_styles')
        .select('tone, vocabulary, banned_phrases')
        .eq('id', style_id)
        .single();
      if (style) {
        primitives.voice = {
          tone: style.tone,
          vocabulary: style.vocabulary ?? [],
          banned_phrases: style.banned_phrases ?? [],
        };
      }
    }

    if (hook) primitives.hook = hook;
    if (instructions) primitives.instructions = instructions;

    // ── 5. Generate post via AI ────────────────────────────────────────────
    const generated = await generateFromPrimitives(primitives);
    if (!generated) {
      return NextResponse.json({ error: 'Post generation failed' }, { status: 500 });
    }

    // ── 6. Save draft post to cp_pipeline_posts ────────────────────────────
    const insertRow: Record<string, unknown> = {
      user_id: userId,
      draft_content: generated.content,
      status: 'draft',
      source: 'ai_generated',
    };

    if (exploit_id) insertRow.exploit_id = exploit_id;
    if (creative_id) insertRow.creative_id = creative_id;
    if (idea_id) insertRow.idea_id = idea_id;
    // Note: cp_pipeline_posts uses team_profile_id (not team_id) for team scoping.
    // Resolving team_profile_id requires a DB lookup; omit here — consistent with
    // createAgentPost default behavior where profile resolution is optional.

    const { data: post, error: insertError } = await supabase
      .from('cp_pipeline_posts')
      .insert(insertRow)
      .select(
        'id, user_id, draft_content, status, exploit_id, creative_id, idea_id, created_at, updated_at'
      )
      .single();

    if (insertError) {
      logError('cp/posts/generate', insertError, { step: 'post_insert_error', userId });
      return NextResponse.json({ error: 'Failed to save post' }, { status: 500 });
    }

    // ── 7. Mark creative as used (fire-and-forget) ─────────────────────────
    if (creative_id) {
      try {
        const { data: currentCreative } = await supabase
          .from('cp_creatives')
          .select('times_used')
          .eq('id', creative_id)
          .eq('user_id', userId)
          .single();

        await supabase
          .from('cp_creatives')
          .update({
            status: 'used',
            times_used: (currentCreative?.times_used ?? 0) + 1,
          })
          .eq('id', creative_id)
          .eq('user_id', userId);
      } catch {
        // Creative usage tracking must never block the response
      }
    }

    // ── 8. Return created post ─────────────────────────────────────────────
    return NextResponse.json({ post, generated }, { status: 201 });
  } catch (error) {
    logError('cp/posts/generate', error, { step: 'generate_post_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
