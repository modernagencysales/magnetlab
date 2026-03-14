import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const leadTools: Tool[] = [
  {
    name: 'magnetlab_list_leads',
    description:
      'List captured leads with filtering and pagination. Returns email, name, qualification status, UTM data, and which funnel/lead magnet they came from. Use search to find leads by email or name.',
    inputSchema: {
      type: 'object',
      properties: {
        funnel_id: { type: 'string', description: 'Filter by specific funnel page UUID' },
        lead_magnet_id: { type: 'string', description: 'Filter by lead magnet UUID' },
        qualified: {
          type: 'boolean',
          description: 'Filter by qualification status (true = qualified, false = unqualified)',
        },
        search: { type: 'string', description: 'Search by email or name (case-insensitive)' },
        limit: { type: 'number', default: 50, description: 'Max results (1-100)' },
        offset: { type: 'number', default: 0, description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'magnetlab_export_leads',
    description:
      'Export leads as CSV file. Filter by funnel, lead magnet, or qualification status. Returns CSV text with headers: email, name, qualified, lead_magnet, funnel_slug, answers, utm_source, utm_medium, utm_campaign, created_at.',
    inputSchema: {
      type: 'object',
      properties: {
        funnel_id: { type: 'string', description: 'Filter by funnel page UUID' },
        lead_magnet_id: { type: 'string', description: 'Filter by lead magnet UUID' },
        qualified: { type: 'boolean', description: 'Filter by qualification status' },
      },
    },
  },
]
