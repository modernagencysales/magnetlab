import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const emailSequenceTools: Tool[] = [
  {
    name: 'magnetlab_get_email_sequence',
    description:
      'Get the email sequence (welcome drip) for a specific lead magnet. Returns the sequence of emails with subject, body, day offset, and reply trigger for each email. Returns null if no sequence exists yet.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_generate_email_sequence',
    description:
      'Generate a 5-email welcome sequence for a lead magnet using AI. Creates personalized emails based on the lead magnet content and brand kit. Set useAI=false for template-based defaults.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
        use_ai: {
          type: 'boolean',
          default: true,
          description: 'Use AI generation (true) or template defaults (false)',
        },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_update_email_sequence',
    description:
      'Update emails in a sequence or change its status. When emails are edited, sync status resets to draft. Each email needs: day (number), subject, body, and replyTrigger (keyword).',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
        emails: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'number', description: 'Day offset from opt-in (e.g. 0, 1, 3, 5, 7)' },
              subject: { type: 'string', description: 'Email subject line' },
              body: { type: 'string', description: 'Email body (supports HTML)' },
              reply_trigger: { type: 'string', description: 'Keyword that triggers this email type' },
            },
            required: ['day', 'subject', 'body', 'reply_trigger'],
          },
          description: 'Full email array (replaces existing)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'synced', 'active'],
          description: 'Set sequence status',
        },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_activate_email_sequence',
    description:
      'Activate an email sequence to start sending to new leads. Syncs with the email provider (Loops/Resend).',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
      },
      required: ['lead_magnet_id'],
    },
  },
]
