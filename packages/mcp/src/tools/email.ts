/** Email sequence tools (3). Get, save (full-replace), activate. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const emailTools: Tool[] = [
  {
    name: 'magnetlab_get_email_sequence',
    description:
      'Get the email sequence for a specific lead magnet. Returns the sequence of emails with subject, body, day offset, and reply trigger. Returns null if no sequence exists yet.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_save_email_sequence',
    description:
      'Save an email sequence for a lead magnet using full-replace semantics. The emails array replaces the entire sequence. Each email needs day, subject, body, and optional replyTrigger.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
        emails: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: {
                type: 'number',
                description: 'Day offset from opt-in (e.g. 0, 1, 3, 5, 7)',
              },
              subject: { type: 'string', description: 'Email subject line' },
              body: { type: 'string', description: 'Email body (supports HTML)' },
              replyTrigger: {
                type: 'string',
                description: 'Keyword that triggers this email type',
              },
            },
            required: ['day', 'subject', 'body'],
          },
          description: 'Full email array (replaces existing sequence)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'synced', 'active'],
          description: 'Set sequence status',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_activate_email_sequence',
    description:
      'Activate an email sequence to start sending to new leads. Syncs with the email provider and marks the sequence as active.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['lead_magnet_id'],
    },
  },
];
