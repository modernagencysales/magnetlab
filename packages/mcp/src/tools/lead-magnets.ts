/** Lead magnet CRUD tools (5). Maps 1:1 to MagnetLabClient methods. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const leadMagnetTools: Tool[] = [
  {
    name: 'magnetlab_list_lead_magnets',
    description: 'List all lead magnets. Returns title, archetype, status, and creation date.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'published', 'archived'],
          description: 'Filter by status',
        },
        limit: { type: 'number', default: 50, description: 'Max results (1-100)' },
        offset: { type: 'number', default: 0, description: 'Offset for pagination' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_lead_magnet',
    description:
      'Get full details of a single lead magnet including its content, archetype, status, and content_version for optimistic locking.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead magnet UUID' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_create_lead_magnet',
    description:
      'Create a new lead magnet. Choose an archetype and provide a title. Use magnetlab_get_archetype_schema first to understand what content fields the archetype requires.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Lead magnet title' },
        archetype: {
          type: 'string',
          enum: [
            'single-breakdown',
            'single-system',
            'focused-toolkit',
            'single-calculator',
            'focused-directory',
            'mini-training',
            'one-story',
            'prompt',
            'assessment',
            'workflow',
          ],
          description: 'Content archetype/format',
        },
        concept: { type: 'object', description: 'Optional concept data from ideation' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['title', 'archetype'],
    },
  },
  {
    name: 'magnetlab_update_lead_magnet',
    description:
      'Update lead magnet content using deep-merge semantics. Pass only the fields you want to change. Arrays are replaced entirely. Set a field to null to remove it. Optionally pass expected_version for optimistic locking.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead magnet UUID' },
        content: {
          type: 'object',
          description:
            'Content fields to merge. Only include fields you want to change. Arrays replace entirely; null removes a field.',
        },
        expected_version: {
          type: 'number',
          description:
            'Content version for optimistic locking. Get from magnetlab_get_lead_magnet. If the version has changed, the update is rejected.',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id', 'content'],
    },
  },
  {
    name: 'magnetlab_delete_lead_magnet',
    description:
      'Permanently delete a lead magnet. Also removes associated funnel pages and leads.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead magnet UUID to delete' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
];
