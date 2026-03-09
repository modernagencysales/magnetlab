import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { searchKnowledgeV2, listKnowledgeTopics } from '@/lib/services/knowledge-brain';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';

registerAction({
  name: 'search_knowledge',
  description: 'Search the AI Brain knowledge base using semantic search. Always call this before writing content to ground it in real expertise from transcripts and calls.',
  parameters: {
    properties: {
      query: { type: 'string', description: 'Semantic search query' },
      knowledge_type: {
        type: 'string',
        enum: ['how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'],
        description: 'Filter by knowledge type',
      },
      topic: { type: 'string', description: 'Filter by topic slug' },
      min_quality: { type: 'number', description: 'Minimum quality score 1-5' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    required: ['query'],
  },
  handler: async (ctx: ActionContext, params: {
    query: string;
    knowledge_type?: string;
    topic?: string;
    min_quality?: number;
    limit?: number;
  }): Promise<ActionResult> => {
    const results = await searchKnowledgeV2(ctx.userId, {
      query: params.query,
      knowledgeType: params.knowledge_type as import('@/lib/types/content-pipeline').KnowledgeType | undefined,
      topicSlug: params.topic,
      minQuality: params.min_quality,
      limit: params.limit || 10,
      teamId: ctx.teamId,
    });
    return { success: true, data: results, displayHint: 'knowledge_list' };
  },
});

registerAction({
  name: 'list_topics',
  description: 'List all auto-discovered knowledge topics with entry counts and quality scores.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max topics to return (default 20)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const topics = await listKnowledgeTopics(ctx.userId, {
      teamId: ctx.teamId,
      limit: params.limit || 20,
    });
    return { success: true, data: topics, displayHint: 'text' };
  },
});

registerAction({
  name: 'build_content_brief',
  description: 'Build a knowledge-powered content brief for a topic. Returns relevant knowledge entries organized by type, suggested angles, and topic readiness score. Use this before writing to inject real expertise.',
  parameters: {
    properties: {
      topic: { type: 'string', description: 'The topic to build a brief for' },
    },
    required: ['topic'],
  },
  handler: async (ctx: ActionContext, params: { topic: string }): Promise<ActionResult> => {
    const brief = await buildContentBrief(ctx.userId, params.topic, {
      teamId: ctx.teamId,
    });
    return { success: true, data: brief, displayHint: 'text' };
  },
});
