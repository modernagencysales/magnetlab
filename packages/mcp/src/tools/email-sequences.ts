import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const emailSequenceTools: Tool[] = [
  {
    name: 'magnetlab_get_email_sequence',
    description:
      'Get the email sequence (welcome drip) for a specific lead magnet. Returns the sequence of emails with subject, body, day offset, and reply trigger for each email. Returns null if no sequence exists yet. ' +
      'Status meanings: "draft" = not sending (safe to edit), "active" = sending to new opt-ins automatically, "synced" = legacy (treat as draft).',
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
      'Generate a 5-email welcome sequence for a lead magnet using AI. Creates personalized emails based on the lead magnet content and brand kit. ' +
      'Creates the sequence in "draft" state — emails are NOT sent until you call magnetlab_activate_email_sequence. ' +
      'Set useAI=false for template-based defaults (WARNING: templates contain placeholder text like "[INSERT TIP]" that MUST be replaced before activating).',
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
      'Update emails in a sequence. Editing emails resets the sequence to "draft" state (stops sending). ' +
      'Review ALL email subjects and bodies for template placeholders like "[INSERT TIP]" or "[Resource 1]" — these MUST be replaced with real content before activating. ' +
      'Each email needs: day (number), subject, body, and replyTrigger (keyword).',
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
              reply_trigger: {
                type: 'string',
                description: 'Keyword that triggers this email type',
              },
            },
            required: ['day', 'subject', 'body', 'reply_trigger'],
          },
          description: 'Full email array (replaces existing)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'active'],
          description:
            'Set sequence status. "draft" = not sending (safe to edit), "active" = sending to new opt-ins. Use magnetlab_activate_email_sequence instead for proper activation with validation.',
        },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_activate_email_sequence',
    description:
      'Activate an email sequence to start sending to new leads who opt in. Transitions status from "draft" → "active". ' +
      'Will FAIL if any email contains template placeholders like "[INSERT TIP]" — fix them first via magnetlab_update_email_sequence. ' +
      'Publishing a funnel does NOT auto-activate its sequence — you must call this explicitly.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
      },
      required: ['lead_magnet_id'],
    },
  },
];
