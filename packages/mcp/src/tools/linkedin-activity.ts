/** LinkedIn activity tool (1). Query the LinkedIn action log across campaigns and accounts. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const linkedinActivityTools: Tool[] = [
  {
    name: 'magnetlab_get_linkedin_activity',
    description:
      'Query the LinkedIn activity log. Returns a paginated list of LinkedIn actions (message sent, connection request sent, connection accepted, post liked, etc.) across all campaigns. Filter by account, action type, date, or source campaign.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Filter by Unipile LinkedIn account ID',
        },
        action_type: {
          type: 'string',
          enum: [
            'message_sent',
            'connection_request_sent',
            'connection_accepted',
            'connection_withdrawn',
            'post_liked',
            'comment_replied',
            'profile_viewed',
          ],
          description: 'Filter by action type',
        },
        since: {
          type: 'string',
          description: 'ISO 8601 date string to filter activity after this date (e.g. 2026-03-01)',
        },
        source_campaign_id: {
          type: 'string',
          description: 'Filter by source outreach or post campaign UUID',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default: 50, max: 200)',
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (default: 0)',
        },
      },
    },
  },
];
