import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { writePost, type WritePostInput } from '@/lib/ai/content-pipeline/post-writer';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';

registerAction({
  name: 'write_post',
  description: 'Write a LinkedIn post on a given topic. Automatically searches knowledge base for relevant context and uses the user\'s voice profile. Returns the full post content + variations.',
  parameters: {
    properties: {
      topic: { type: 'string', description: 'The topic or idea to write about' },
      content_type: {
        type: 'string',
        enum: ['thought_leadership', 'personal_story', 'how_to', 'contrarian', 'case_study', 'listicle', 'question', 'announcement'],
        description: 'Post format/type',
      },
      template_id: { type: 'string', description: 'Optional template ID to guide the structure' },
      style_id: { type: 'string', description: 'Optional writing style ID' },
    },
    required: ['topic'],
  },
  handler: async (ctx: ActionContext, params: {
    topic: string;
    content_type?: string;
    template_id?: string;
    style_id?: string;
  }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    // Build knowledge brief for context
    const brief = await buildContentBrief(ctx.userId, params.topic, { teamId: ctx.teamId });

    // Get voice profile
    const { data: profile } = await supabase
      .from('team_profiles')
      .select('voice_profile, full_name, title')
      .eq('user_id', ctx.userId)
      .limit(1)
      .single();

    const input: WritePostInput = {
      idea: {
        title: params.topic,
        core_insight: params.topic,
        content_type: params.content_type || 'thought_leadership',
        full_context: brief.compiledContext || '',
        hook: '',
        key_points: [],
      },
      knowledgeContext: brief.compiledContext,
      voiceProfile: profile?.voice_profile || undefined,
      authorName: profile?.full_name || undefined,
      authorTitle: profile?.title || undefined,
    };

    // Load template if specified
    if (params.template_id) {
      const { data: template } = await supabase
        .from('cp_post_templates')
        .select('*')
        .eq('id', params.template_id)
        .eq('user_id', ctx.userId)
        .single();
      if (template) {
        input.template = template;
      }
    }

    const result = await writePost(input);

    // Persist to pipeline
    const { data: post } = await supabase
      .from('cp_pipeline_posts')
      .insert({
        user_id: ctx.userId,
        draft_content: result.content,
        variations: result.variations?.map((v, i) => ({
          id: `copilot-var-${i}-${Date.now()}`,
          content: v.content,
          selected: false,
        })),
        dm_template: result.dm_template,
        cta_word: result.cta_word,
        status: 'draft',
        template_id: params.template_id || null,
        style_id: params.style_id || null,
      })
      .select('id, draft_content, status, created_at')
      .single();

    return {
      success: true,
      data: { post, content: result.content, variations: result.variations },
      displayHint: 'post_preview',
    };
  },
});

registerAction({
  name: 'polish_post',
  description: 'Polish/improve an existing post — removes AI patterns, strengthens the hook, tightens the writing. Returns the polished version.',
  parameters: {
    properties: {
      post_id: { type: 'string', description: 'The post ID to polish' },
    },
    required: ['post_id'],
  },
  handler: async (ctx: ActionContext, params: { post_id: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data: post } = await supabase
      .from('cp_pipeline_posts')
      .select('id, draft_content, final_content')
      .eq('id', params.post_id)
      .eq('user_id', ctx.userId)
      .single();

    if (!post) return { success: false, error: 'Post not found' };

    const content = post.final_content || post.draft_content;
    if (!content) return { success: false, error: 'Post has no content' };

    const result = await polishPost(content);

    // Save polished content
    await supabase
      .from('cp_pipeline_posts')
      .update({ final_content: result.polished, polish_status: 'polished' })
      .eq('id', params.post_id)
      .eq('user_id', ctx.userId);

    return {
      success: true,
      data: { original: result.original, polished: result.polished, changes: result.changes, hookScore: result.hookScore },
      displayHint: 'post_preview',
    };
  },
});

registerAction({
  name: 'list_posts',
  description: 'List pipeline posts filtered by status. Returns post ID, content preview, status, and scheduled time.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'reviewing', 'scheduled', 'published', 'failed'],
        description: 'Filter by post status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { status?: string; limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_pipeline_posts')
      .select('id, draft_content, final_content, status, scheduled_time, hook_score, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data: posts } = await query;

    return {
      success: true,
      data: (posts || []).map(p => ({
        id: p.id,
        content_preview: (p.final_content || p.draft_content || '').slice(0, 150),
        status: p.status,
        scheduled_time: p.scheduled_time,
        hook_score: p.hook_score,
      })),
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'update_post_content',
  description: 'Update the content of an existing draft post. Use this when the user asks you to edit, rewrite, or modify a specific post.',
  parameters: {
    properties: {
      post_id: { type: 'string', description: 'The post ID to update' },
      content: { type: 'string', description: 'The new post content' },
    },
    required: ['post_id', 'content'],
  },
  handler: async (ctx: ActionContext, params: { post_id: string; content: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('cp_pipeline_posts')
      .update({ draft_content: params.content, updated_at: new Date().toISOString() })
      .eq('id', params.post_id)
      .eq('user_id', ctx.userId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { post_id: params.post_id, updated: true }, displayHint: 'text' };
  },
});
