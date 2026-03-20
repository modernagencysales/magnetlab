/** DM Coach tools (7). List, create, get, update, delete contacts, add messages, and get AI coaching suggestions. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const dmCoachTools: Tool[] = [
  {
    name: 'magnetlab_list_dm_contacts',
    description:
      'List DM Coach contacts with optional filters. Returns contacts with name, goal, stage, status, and message counts.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'closed_won', 'closed_lost'],
          description: 'Filter by status',
        },
        goal: {
          type: 'string',
          enum: [
            'book_meeting',
            'build_relationship',
            'promote_content',
            'explore_partnership',
            'nurture_lead',
            'close_deal',
          ],
          description: 'Filter by goal',
        },
        search: { type: 'string', description: 'Search by name' },
      },
    },
  },
  {
    name: 'magnetlab_get_dm_contact',
    description: 'Get a DM Coach contact with conversation history and latest suggestion.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'magnetlab_create_dm_contact',
    description:
      'Create a new DM Coach contact for conversation coaching. Only name is required — other fields enrich the coaching context.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Contact name' },
        linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
        headline: { type: 'string', description: 'Contact headline/title' },
        company: { type: 'string', description: 'Company name' },
        location: { type: 'string', description: 'Location' },
        conversation_goal: {
          type: 'string',
          enum: [
            'book_meeting',
            'build_relationship',
            'promote_content',
            'explore_partnership',
            'nurture_lead',
            'close_deal',
          ],
          description: 'Conversation goal',
        },
        notes: { type: 'string', description: 'Notes about this contact' },
      },
      required: ['name'],
    },
  },
  {
    name: 'magnetlab_update_dm_contact',
    description:
      'Update a DM Coach contact (goal, stage, status, notes, etc). Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID' },
        name: { type: 'string' },
        headline: { type: 'string' },
        company: { type: 'string' },
        location: { type: 'string' },
        conversation_goal: {
          type: 'string',
          enum: [
            'book_meeting',
            'build_relationship',
            'promote_content',
            'explore_partnership',
            'nurture_lead',
            'close_deal',
          ],
        },
        qualification_stage: {
          type: 'string',
          enum: ['unknown', 'situation', 'pain', 'impact', 'vision', 'capability', 'commitment'],
        },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'closed_won', 'closed_lost'],
        },
        notes: { type: 'string' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'magnetlab_delete_dm_contact',
    description: 'Delete a DM Coach contact and all its messages.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'magnetlab_add_dm_messages',
    description:
      'Add messages to a DM Coach contact conversation. Use role "them" for messages received and "me" for messages sent.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['them', 'me'],
                description: 'Who sent this message',
              },
              content: { type: 'string', description: 'Message text' },
              timestamp: {
                type: 'string',
                description: 'ISO timestamp (optional, defaults to now)',
              },
            },
            required: ['role', 'content'],
          },
          description: 'Messages to add',
        },
      },
      required: ['contact_id', 'messages'],
    },
  },
  {
    name: 'magnetlab_dm_coach_suggest',
    description:
      'Get an AI coaching suggestion for a DM conversation. Returns style-matched reply with full reasoning (stage analysis, signals, strategy, goal alignment).',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID' },
      },
      required: ['contact_id'],
    },
  },
];
