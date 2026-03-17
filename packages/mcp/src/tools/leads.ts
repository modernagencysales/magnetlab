/** Lead management tools (3). List, get, export. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const leadTools: Tool[] = [
  {
    name: 'magnetlab_list_leads',
    description:
      'List captured leads with filtering and pagination. Returns email, name, qualification status, UTM data, and which funnel/lead magnet they came from.',
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
        limit: { type: 'number', default: 20, description: 'Max results (1-100)' },
        offset: { type: 'number', default: 0, description: 'Pagination offset' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_lead',
    description:
      'Get full details of a single lead including email, name, qualification answers, UTM data, funnel source, and timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead UUID' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_export_leads',
    description:
      'Export leads as CSV. Filter by funnel, lead magnet, or qualification status. Returns CSV text with headers: email, name, qualified, lead_magnet, funnel_slug, answers, utm_source, utm_medium, utm_campaign, created_at.',
    inputSchema: {
      type: 'object',
      properties: {
        funnel_id: { type: 'string', description: 'Filter by funnel page UUID' },
        lead_magnet_id: { type: 'string', description: 'Filter by lead magnet UUID' },
        qualified: { type: 'boolean', description: 'Filter by qualification status' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
];
