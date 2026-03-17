/** Feedback and analytics tools (2). Performance insights and recommendations. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const feedbackTools: Tool[] = [
  {
    name: 'magnetlab_get_performance_insights',
    description:
      'Get performance insights across lead magnets, funnels, and content. Returns metrics, trends, and notable changes over the specified period.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['7d', '30d', '90d'],
          description: 'Time period for insights (default: 30d)',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_recommendations',
    description:
      'Get actionable recommendations based on your current lead magnets, funnels, and content performance. Suggestions for improvement prioritized by impact.',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
];
