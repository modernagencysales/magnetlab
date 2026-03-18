/** Account safety tools (2). Get and update LinkedIn account safety limits and operating hours. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const accountSafetyTools: Tool[] = [
  {
    name: 'magnetlab_get_account_safety_settings',
    description:
      'Get safety settings for a LinkedIn account. Returns daily action limits (DMs, connection requests, likes, comments), delay ranges, and operating hours.',
    inputSchema: {
      type: 'object',
      properties: {
        unipile_account_id: {
          type: 'string',
          description: 'Unipile LinkedIn account ID to get settings for',
        },
      },
      required: ['unipile_account_id'],
    },
  },
  {
    name: 'magnetlab_update_account_safety_settings',
    description:
      'Update safety settings for a LinkedIn account. Set daily limits for DMs, connection requests, likes, comments, delay ranges between actions, and operating hours window.',
    inputSchema: {
      type: 'object',
      properties: {
        unipile_account_id: {
          type: 'string',
          description: 'Unipile LinkedIn account ID to update settings for',
        },
        max_dms_per_day: {
          type: 'number',
          description: 'Maximum DMs to send per day (non-negative integer)',
        },
        max_connection_requests_per_day: {
          type: 'number',
          description: 'Maximum connection requests per day (non-negative integer)',
        },
        max_connection_accepts_per_day: {
          type: 'number',
          description: 'Maximum connection accepts per day (non-negative integer)',
        },
        max_comments_per_day: {
          type: 'number',
          description: 'Maximum comments per day (non-negative integer)',
        },
        max_likes_per_day: {
          type: 'number',
          description: 'Maximum likes per day (non-negative integer)',
        },
        min_action_delay_ms: {
          type: 'number',
          description: 'Minimum delay between actions in milliseconds',
        },
        max_action_delay_ms: {
          type: 'number',
          description: 'Maximum delay between actions in milliseconds',
        },
        operating_hours_start: {
          type: 'string',
          description: 'Start of operating hours in HH:MM format (e.g. "09:00")',
        },
        operating_hours_end: {
          type: 'string',
          description: 'End of operating hours in HH:MM format (e.g. "17:00")',
        },
        timezone: {
          type: 'string',
          description: 'IANA timezone (e.g. "America/New_York")',
        },
      },
      required: ['unipile_account_id'],
    },
  },
];
