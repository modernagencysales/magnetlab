import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const emailSystemTools: Tool[] = [
  // ── Flows ──────────────────────────────────────────────────
  {
    name: 'magnetlab_list_email_flows',
    description:
      'List all email flows (automated drip sequences). Returns flows with step counts, ordered by creation date.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_get_email_flow',
    description:
      'Get a single email flow with all its steps. Returns the flow details including every step (subject, body, delay_days) ordered by step_number.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Flow UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_create_email_flow',
    description:
      'Create a new email flow. Flows start as drafts. Set trigger_type to "lead_magnet" to auto-enroll new leads from a specific lead magnet, or "manual" for manual enrollment.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Flow name (1-200 chars)' },
        trigger_type: {
          type: 'string',
          enum: ['lead_magnet', 'manual'],
          description: 'How subscribers enter this flow',
        },
        description: { type: 'string', description: 'Optional flow description (max 1000 chars)' },
        trigger_lead_magnet_id: {
          type: 'string',
          description: 'Lead magnet UUID (required when trigger_type is "lead_magnet")',
        },
      },
      required: ['name', 'trigger_type'],
    },
  },
  {
    name: 'magnetlab_update_email_flow',
    description:
      'Update an email flow\'s name, description, status, or trigger. Setting status to "active" requires at least one step. Only draft or paused flows can be edited.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Flow UUID' },
        name: { type: 'string', description: 'New flow name' },
        description: { type: 'string', description: 'New description (null to clear)' },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'paused'],
          description: 'Flow status',
        },
        trigger_type: {
          type: 'string',
          enum: ['lead_magnet', 'manual'],
          description: 'Trigger type',
        },
        trigger_lead_magnet_id: {
          type: 'string',
          description: 'Lead magnet UUID (null to clear)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_delete_email_flow',
    description:
      'Delete an email flow. Only draft or paused flows can be deleted. Active flows must be paused first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Flow UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_add_flow_step',
    description:
      'Add a step (email) to a flow. Each step has a subject, body (HTML), delay in days from the previous step, and a step number for ordering. Flow must be draft or paused.',
    inputSchema: {
      type: 'object',
      properties: {
        flow_id: { type: 'string', description: 'Flow UUID' },
        step_number: { type: 'integer', description: 'Order position (0-based)' },
        subject: { type: 'string', description: 'Email subject line (1-500 chars)' },
        body: { type: 'string', description: 'Email body (supports HTML)' },
        delay_days: {
          type: 'integer',
          description: 'Days to wait after previous step (0-365)',
        },
      },
      required: ['flow_id', 'step_number', 'subject', 'body', 'delay_days'],
    },
  },
  {
    name: 'magnetlab_generate_flow_emails',
    description:
      'Use AI to generate email steps for a flow. Creates a series of emails based on the flow context and brand kit.',
    inputSchema: {
      type: 'object',
      properties: {
        flow_id: { type: 'string', description: 'Flow UUID' },
        step_count: {
          type: 'integer',
          description: 'Number of emails to generate (default: 5)',
        },
      },
      required: ['flow_id'],
    },
  },

  // ── Broadcasts ─────────────────────────────────────────────
  {
    name: 'magnetlab_list_broadcasts',
    description:
      'List all email broadcasts (one-time sends). Returns broadcasts ordered by creation date.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_get_broadcast',
    description:
      'Get a single broadcast with its full details including subject, body, status, audience filter, and recipient count.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Broadcast UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_create_broadcast',
    description:
      'Create a new draft broadcast. Subject and body can be set now or later via update.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Email subject line (max 500 chars)' },
        body: { type: 'string', description: 'Email body (supports HTML)' },
      },
    },
  },
  {
    name: 'magnetlab_update_broadcast',
    description:
      'Update a draft broadcast\'s subject, body, or audience filter. Only draft broadcasts can be edited.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Broadcast UUID' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (supports HTML)' },
        audience_filter: {
          type: 'object',
          description:
            'Filter recipients by engagement or source. Set to null to send to all subscribers.',
          properties: {
            engagement: {
              type: 'string',
              enum: [
                'opened_30d',
                'opened_60d',
                'opened_90d',
                'clicked_30d',
                'clicked_60d',
                'clicked_90d',
                'never_opened',
              ],
              description: 'Filter by engagement level',
            },
            source: { type: 'string', description: 'Filter by subscriber source' },
          },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_send_broadcast',
    description:
      'Queue a draft broadcast for sending. Requires subject and body to be set, and at least one matching subscriber. Returns the recipient count.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Broadcast UUID' },
      },
      required: ['id'],
    },
  },

  // ── Subscribers ────────────────────────────────────────────
  {
    name: 'magnetlab_list_subscribers',
    description:
      'List email subscribers with optional search, status filter, source filter, and pagination. Returns subscribers with total count.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by email, first name, or last name' },
        status: {
          type: 'string',
          enum: ['active', 'unsubscribed', 'bounced'],
          description: 'Filter by subscriber status',
        },
        source: {
          type: 'string',
          enum: ['lead_magnet', 'manual', 'import'],
          description: 'Filter by how the subscriber was added',
        },
        page: { type: 'integer', description: 'Page number (default 1)' },
        limit: { type: 'integer', description: 'Items per page (default 50, max 100)' },
      },
    },
  },
  {
    name: 'magnetlab_add_subscriber',
    description:
      'Add a subscriber manually. If the email already exists, updates the name fields. Email is lowercased and trimmed automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Subscriber email address' },
        first_name: { type: 'string', description: 'First name (max 200 chars)' },
        last_name: { type: 'string', description: 'Last name (max 200 chars)' },
      },
      required: ['email'],
    },
  },
  {
    name: 'magnetlab_unsubscribe',
    description:
      'Unsubscribe a subscriber (soft delete). Sets status to unsubscribed and deactivates any active flow enrollments.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Subscriber UUID' },
      },
      required: ['id'],
    },
  },
]
