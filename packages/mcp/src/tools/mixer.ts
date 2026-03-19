/** Ingredients mixer tools (4). Inventory, recipes, mix, combo-performance. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const mixerTools: Tool[] = [
  {
    name: 'magnetlab_get_ingredient_inventory',
    description:
      'Get ingredient counts and health status for a team profile. Check this first to see what ingredients are available.',
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: { type: 'string', description: 'Team profile ID to scope this operation' },
      },
      required: ['team_profile_id'],
    },
  },
  {
    name: 'magnetlab_get_suggested_recipes',
    description:
      'Get suggested ingredient combinations based on past performance. Returns top combos with engagement multipliers.',
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: { type: 'string', description: 'Team profile ID to scope this operation' },
        limit: { type: 'number', default: 5, description: 'Number of suggested recipes to return' },
      },
      required: ['team_profile_id'],
    },
  },
  {
    name: 'magnetlab_mix',
    description:
      'Generate content by combining ingredients. Pick any combination of exploit, knowledge topic, style, template, creative, trend, or recycled post. Returns drafts or ideas.',
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: { type: 'string', description: 'Team profile ID to scope this operation' },
        exploit_id: { type: 'string', description: 'ID of an exploit to use as the hook mechanic' },
        knowledge_topic: { type: 'string', description: 'Knowledge topic name to draw from' },
        knowledge_query: {
          type: 'string',
          description: 'Semantic query to retrieve relevant knowledge entries',
        },
        style_id: { type: 'string', description: 'Writing style ID to apply' },
        template_id: { type: 'string', description: 'Post template ID to use as structure' },
        creative_id: { type: 'string', description: 'Creative/swipe inspiration ID' },
        trend_topic: { type: 'string', description: 'Trending topic to anchor the content' },
        recycled_post_id: {
          type: 'string',
          description: 'ID of a past post to remix or repurpose',
        },
        idea_id: { type: 'string', description: 'Existing content idea ID to expand' },
        hook: { type: 'string', description: 'Custom hook or opening line' },
        instructions: {
          type: 'string',
          description: 'Free-form generation instructions for the AI',
        },
        count: { type: 'number', default: 3, description: 'Number of drafts or ideas to generate' },
        output: {
          type: 'string',
          enum: ['drafts', 'ideas'],
          default: 'drafts',
          description: 'Whether to return finished drafts or idea seeds',
        },
      },
      required: ['team_profile_id'],
    },
  },
  {
    name: 'magnetlab_get_combo_performance',
    description:
      'Get historical performance data for ingredient combinations. Shows which combos produce the best-performing posts.',
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: { type: 'string', description: 'Team profile ID to scope this operation' },
        limit: {
          type: 'number',
          default: 10,
          description: 'Number of top-performing combos to return',
        },
      },
      required: ['team_profile_id'],
    },
  },
];
