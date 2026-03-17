/** Schema introspection tools (3). List archetypes, get archetype schema, get business context. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const schemaTools: Tool[] = [
  {
    name: 'magnetlab_list_archetypes',
    description:
      'List all available lead magnet archetypes with their descriptions. Use this to understand what formats are available before creating a lead magnet.',
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
  {
    name: 'magnetlab_get_archetype_schema',
    description:
      'Get the Zod publish schema and quality guidelines for a specific archetype. Use this to understand what content fields are required before creating or updating a lead magnet.',
    inputSchema: {
      type: 'object',
      properties: {
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
          description: 'Archetype slug',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['archetype'],
    },
  },
  {
    name: 'magnetlab_get_business_context',
    description:
      'Get the content pipeline business context. Contains content strategy configuration: pillars, audience, topics, and voice settings used for AI content generation.',
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
