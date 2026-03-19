/** Outreach campaign tools (11). List, create, get, update, activate, pause, delete campaigns, plus lead management (add, list, get, skip). */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const outreachCampaignTools: Tool[] = [
  {
    name: 'magnetlab_create_outreach_campaign',
    description:
      'Create a new LinkedIn outreach campaign. Choose a preset (warm_connect, direct_connect, nurture) that controls the default message sequence flow. Requires a name, preset, and LinkedIn account ID. Provide message templates to customize the sequence.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        preset: {
          type: 'string',
          enum: ['warm_connect', 'direct_connect', 'nurture'],
          description:
            'Campaign preset that controls the outreach sequence flow. warm_connect: message → connect → follow-up. direct_connect: connect with note → follow-up. nurture: multi-touch follow-up sequence.',
        },
        account_id: {
          type: 'string',
          description: 'Unipile LinkedIn account ID used to send messages and connection requests',
        },
        first_message_template: {
          type: 'string',
          description:
            'First message template. Use {{first_name}}, {{company}}, {{title}} placeholders.',
        },
        connect_message: {
          type: 'string',
          description:
            'Optional connection request note (max 300 chars). Used in direct_connect preset or when sending connection requests.',
        },
        follow_up_template: {
          type: 'string',
          description: 'Optional follow-up message template sent after connection is accepted.',
        },
        follow_up_delay_days: {
          type: 'number',
          description: 'Days to wait after connection before sending follow-up (default: 3)',
        },
        withdraw_delay_days: {
          type: 'number',
          description:
            'Days to wait before withdrawing unanswered connection requests (default: 14)',
        },
      },
      required: ['name', 'preset', 'account_id', 'first_message_template'],
    },
  },
  {
    name: 'magnetlab_list_outreach_campaigns',
    description:
      'List LinkedIn outreach campaigns. Optionally filter by status (draft, active, paused, completed). Returns campaign name, status, preset, lead counts, and response rates.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'active', 'paused', 'completed'],
          description: 'Filter by campaign status',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_outreach_campaign',
    description:
      'Get full details of an outreach campaign including configuration, lead statistics, message templates, and activity summary.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Outreach campaign UUID' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_update_outreach_campaign',
    description:
      'Update an outreach campaign configuration. Only provided fields are updated. Cannot update campaigns that are active — pause first.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Outreach campaign UUID' },
        name: { type: 'string', description: 'Updated campaign name' },
        first_message_template: {
          type: 'string',
          description: 'Updated first message template',
        },
        connect_message: {
          type: 'string',
          description: 'Updated connection request note',
        },
        follow_up_template: {
          type: 'string',
          description: 'Updated follow-up message template',
        },
        follow_up_delay_days: {
          type: 'number',
          description: 'Updated days to wait before sending follow-up',
        },
        withdraw_delay_days: {
          type: 'number',
          description: 'Updated days to wait before withdrawing pending connection requests',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_activate_outreach_campaign',
    description:
      'Activate an outreach campaign to start processing leads and sending messages. Campaign must be in draft or paused status and have at least one lead.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Outreach campaign UUID to activate' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_pause_outreach_campaign',
    description:
      'Pause an active outreach campaign. Stops processing new leads and sending messages. In-flight messages are not cancelled.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Outreach campaign UUID to pause' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_delete_outreach_campaign',
    description:
      'Delete an outreach campaign and all associated lead records. Cannot delete active campaigns — pause first.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Outreach campaign UUID to delete' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_add_outreach_leads',
    description:
      'Add leads to an outreach campaign. Each lead requires a LinkedIn URL. Name and company are optional enrichment hints. Duplicate LinkedIn URLs are ignored.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Outreach campaign UUID' },
        leads: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              linkedin_url: {
                type: 'string',
                description: 'LinkedIn profile URL for the lead',
              },
              name: { type: 'string', description: 'Optional full name' },
              company: { type: 'string', description: 'Optional company name' },
            },
            required: ['linkedin_url'],
          },
          description: 'Array of leads to add to the campaign',
        },
      },
      required: ['campaign_id', 'leads'],
    },
  },
  {
    name: 'magnetlab_list_outreach_leads',
    description:
      'List leads in an outreach campaign. Optionally filter by status (pending, messaged, connected, replied, skipped, withdrawn). Returns lead name, LinkedIn URL, status, and last activity date.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Outreach campaign UUID' },
        status: {
          type: 'string',
          enum: ['pending', 'messaged', 'connected', 'replied', 'skipped', 'withdrawn'],
          description: 'Filter by lead status',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_get_outreach_lead',
    description:
      'Get full details of an outreach lead including activity history, message log, and current status.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Outreach lead UUID' },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'magnetlab_skip_outreach_lead',
    description:
      'Skip an outreach lead to exclude them from future processing. Use for leads that are no longer relevant or have been handled outside the campaign.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Outreach lead UUID to skip' },
      },
      required: ['lead_id'],
    },
  },
];
