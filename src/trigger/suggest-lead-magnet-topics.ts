import { task, schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { CLAUDE_SONNET_MODEL } from '@/lib/ai/content-pipeline/model-config';
import { listKnowledgeTopics, getTopicDetail } from '@/lib/services/knowledge-brain';
import { analyzeTopicGaps } from '@/lib/ai/content-pipeline/knowledge-gap-analyzer';

interface TopicSuggestion {
  title: string;
  core_insight: string;
  why_post_worthy: string;
  content_type: string;
}

interface SuggestLeadMagnetPayload {
  userId: string;
  teamId?: string;
  profileId?: string;
}

export const suggestLeadMagnetTopics = task({
  id: 'suggest-lead-magnet-topics',
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async (payload: SuggestLeadMagnetPayload) => {
    const { userId, teamId, profileId } = payload;
    const supabase = createSupabaseAdminClient();

    // 1. Get knowledge topics for this user/team
    const topics = await listKnowledgeTopics(userId, { teamId, limit: 30 });

    if (topics.length === 0) {
      logger.info('No knowledge topics found, skipping lead magnet suggestion', { userId });
      return { suggestions: 0, reason: 'no_topics' };
    }

    // 2. Get recent high-performing posts (engagement proxy: status=published, recent)
    const { data: recentPosts } = await supabase
      .from('cp_pipeline_posts')
      .select('draft_content, final_content, status')
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(10);

    // 3. Get gap analysis for top topics (enriched with type breakdowns)
    const gapResults = [];
    for (const topic of topics.slice(0, 10)) {
      const detail = await getTopicDetail(userId, topic.slug, teamId);
      const gap = analyzeTopicGaps(
        topic.slug,
        topic.display_name,
        detail.type_breakdown,
        topic.avg_quality,
        topic.last_seen || null
      );
      gapResults.push(gap);
    }

    // 4. Generate suggestions via Claude
    const client = getAnthropicClient('suggest-lead-magnet-topics');
    const response = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a content strategist. Suggest 3 lead magnet topics based on this knowledge base analysis.

KNOWLEDGE TOPICS (with entry counts):
${topics.slice(0, 20).map(t => `- ${t.display_name || t.slug} (${t.entry_count || 0} entries, quality: ${t.avg_quality?.toFixed(1) || 'N/A'})`).join('\n')}

RECENT PUBLISHED POST TOPICS:
${(recentPosts || []).slice(0, 5).map(p => `- ${(p.final_content || p.draft_content || '').slice(0, 100)}`).join('\n')}

GAP ANALYSIS:
${JSON.stringify(gapResults.slice(0, 5)).slice(0, 1500)}

RULES:
- Each suggestion should solve a specific B2B pain point
- Prefer topics with deep knowledge (high entry count + quality)
- Avoid topics already heavily covered in recent posts
- Each should work as a downloadable guide, checklist, or framework

Return ONLY valid JSON array of 3 objects with: "title", "core_insight" (1-2 sentences), "why_post_worthy" (why this would attract leads), "content_type" (always "lead_magnet")`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const suggestions = parseJsonResponse<TopicSuggestion[]>(text);

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      logger.warn('No valid suggestions parsed from Claude response', { userId });
      return { suggestions: 0, reason: 'parse_failed' };
    }

    // 5. Store in cp_content_ideas
    let stored = 0;
    for (const suggestion of suggestions) {
      const { error } = await supabase.from('cp_content_ideas').insert({
        user_id: userId,
        team_profile_id: profileId || null,
        title: suggestion.title,
        core_insight: suggestion.core_insight,
        why_post_worthy: suggestion.why_post_worthy,
        content_type: 'lead_magnet',
        status: 'extracted',
      });

      if (error) {
        logger.error('Failed to insert lead magnet idea', { error: error.message, title: suggestion.title });
      } else {
        stored++;
      }
    }

    logger.info(`Generated ${stored} lead magnet topic suggestions`, { userId, stored });
    return { suggestions: stored };
  },
});

// Weekly schedule: Monday 8 AM UTC
export const weeklyLeadMagnetSuggestions = schedules.task({
  id: 'weekly-lead-magnet-suggestions',
  cron: '0 8 * * 1', // Monday 8 AM UTC
  maxDuration: 600,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Get all users with active posting slots (proxy for active content pipeline users)
    const { data: activeSlots } = await supabase
      .from('cp_posting_slots')
      .select('user_id')
      .eq('is_active', true);

    const userIds = [...new Set(activeSlots?.map(s => s.user_id) || [])];

    if (userIds.length === 0) {
      logger.info('No active users for lead magnet suggestions');
      return { usersProcessed: 0 };
    }

    logger.info('Generating lead magnet suggestions', { userCount: userIds.length });

    let triggered = 0;

    for (const userId of userIds) {
      // Check if user has a team and active profile
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', userId)
        .single();

      let profileId: string | undefined;
      if (team) {
        const { data: profiles } = await supabase
          .from('team_profiles')
          .select('id')
          .eq('team_id', team.id)
          .eq('status', 'active')
          .limit(1);

        profileId = profiles?.[0]?.id;
      }

      await suggestLeadMagnetTopics.trigger({
        userId,
        teamId: team?.id,
        profileId,
      });

      triggered++;
    }

    logger.info('Weekly lead magnet suggestions triggered', { triggered });
    return { usersProcessed: triggered };
  },
});
