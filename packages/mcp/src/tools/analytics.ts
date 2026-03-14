import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const analyticsTools: Tool[] = [
  {
    name: 'magnetlab_get_funnel_stats',
    description:
      'Get aggregate statistics for all your funnel pages. Returns per-funnel breakdown of total leads, qualified leads, unqualified leads, page views, conversion rate (views-to-leads), and qualification rate.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]
