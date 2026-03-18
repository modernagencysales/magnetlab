/** Content queue tools (3). List queue, update queue post, submit batch for client review. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const contentQueueTools: Tool[] = [
  {
    name: 'magnetlab_list_content_queue',
    description:
      'Lists the content editing queue across all teams. Returns draft posts grouped by team, showing which posts need editing before client review.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_update_queue_post',
    description:
      'Updates a post in the content queue. Can update the draft content, mark the post as edited, or attach image URLs. Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Pipeline post UUID to update' },
        draft_content: { type: 'string', description: 'Updated draft content for the post' },
        mark_edited: {
          type: 'boolean',
          description: 'When true, marks the post as editor-reviewed',
        },
        image_urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Image URLs to attach to the post',
        },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'magnetlab_submit_queue_batch',
    description:
      "Submits a team's edited posts for client review. Marks all edited posts as ready and optionally fires a DFY callback to notify the client.",
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Team ID whose posts to submit for review' },
      },
      required: ['team_id'],
    },
  },
];
