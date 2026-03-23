/** Post campaign tools (8). List, create, auto-setup, get, update, activate, pause, delete campaigns. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const postCampaignTools: Tool[] = [
  {
    name: 'magnetlab_list_post_campaigns',
    description:
      'List post campaigns. Optionally filter by status (draft, active, paused, completed). Returns campaign name, status, post URL, and lead counts.',
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
    name: 'magnetlab_create_post_campaign',
    description:
      'Create a new post campaign for automated LinkedIn lead capture. Requires a name, post URL, LinkedIn account ID, and DM template. Optionally link a funnel page for lead magnet delivery.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        post_url: { type: 'string', description: 'LinkedIn post URL to monitor' },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords to match in comments (e.g. ["guide", "send"])',
        },
        unipile_account_id: {
          type: 'string',
          description: 'Unipile LinkedIn account ID for sending DMs',
        },
        dm_template: {
          type: 'string',
          description: 'DM message template. Use {{first_name}} and {{funnel_url}} placeholders.',
        },
        funnel_page_id: {
          type: 'string',
          description: 'Optional funnel page ID to include in DM link',
        },
        reply_template: {
          type: 'string',
          description: 'Optional reply template for comment responses',
        },
        poster_account_id: {
          type: 'string',
          description:
            'Optional Unipile account ID of the post author (if different from DM sender)',
        },
        target_locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional location filters for leads',
        },
        auto_accept_connections: {
          type: 'boolean',
          description: 'Auto-accept connection requests from commenters (default: false)',
        },
        auto_like_comments: {
          type: 'boolean',
          description: 'Auto-like matching comments (default: false)',
        },
        auto_connect_non_requesters: {
          type: 'boolean',
          description:
            'Auto-send connection requests to commenters not yet connected (default: false)',
        },
        sender_name: {
          type: 'string',
          description: 'Display name when sending DMs',
        },
        connect_message_template: {
          type: 'string',
          description: 'Message sent with connection requests. Supports {{name}} placeholder.',
        },
        lead_expiry_days: {
          type: 'number',
          description: 'Days before leads expire (default: 30)',
        },
      },
      required: ['name', 'post_url', 'keywords', 'unipile_account_id', 'dm_template'],
    },
  },
  {
    name: 'magnetlab_auto_setup_post_campaign',
    description:
      'AI auto-setup a post campaign from an existing pipeline post. Analyzes the post text to generate campaign name, keywords, DM template, and reply template automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'Pipeline post UUID to analyze for campaign setup',
        },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'magnetlab_get_post_campaign',
    description:
      'Get full details of a post campaign including configuration, lead statistics, and activity counts.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Post campaign UUID' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_update_post_campaign',
    description:
      'Update a post campaign configuration. Only provided fields are updated. Cannot update campaigns that are completed.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Post campaign UUID' },
        name: { type: 'string', description: 'Updated campaign name' },
        post_url: { type: 'string', description: 'Updated LinkedIn post URL' },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated keywords list',
        },
        dm_template: { type: 'string', description: 'Updated DM message template' },
        funnel_page_id: { type: 'string', description: 'Updated funnel page ID (null to remove)' },
        reply_template: { type: 'string', description: 'Updated reply template' },
        target_locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated location filters',
        },
        auto_accept_connections: { type: 'boolean', description: 'Updated auto-accept setting' },
        auto_like_comments: { type: 'boolean', description: 'Updated auto-like setting' },
        auto_connect_non_requesters: {
          type: 'boolean',
          description: 'Updated auto-connect setting',
        },
        sender_name: {
          type: 'string',
          description: 'Display name when sending DMs',
        },
        connect_message_template: {
          type: 'string',
          description: 'Message sent with connection requests. Supports {{name}} placeholder.',
        },
        lead_expiry_days: {
          type: 'number',
          description: 'Days before leads expire (default: 30)',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_activate_post_campaign',
    description:
      'Activate a post campaign to start monitoring comments and sending DMs. Campaign must be in draft or paused status.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Post campaign UUID to activate' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_pause_post_campaign',
    description: 'Pause an active post campaign. Stops comment monitoring and DM sending.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Post campaign UUID to pause' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'magnetlab_delete_post_campaign',
    description: 'Delete a post campaign. Cannot delete active campaigns — pause first.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Post campaign UUID to delete' },
      },
      required: ['campaign_id'],
    },
  },
];
