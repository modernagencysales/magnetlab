/** Content queue tools (6). List queue, update queue post, review lead magnet, review funnel, submit batch, submit asset review. */

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
      'Updates a post in the content queue. Can update the draft content or mark the post as edited. Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Pipeline post UUID to update' },
        draft_content: { type: 'string', description: 'Updated draft content for the post' },
        mark_edited: {
          type: 'boolean',
          description: 'When true, marks the post as editor-reviewed',
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
  {
    name: 'magnetlab_review_lead_magnet',
    description:
      'Marks a lead magnet as reviewed (or un-reviewed) by the DFY editor. Use reviewed: true to approve, reviewed: false to revert.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID to mark as reviewed' },
        reviewed: { type: 'boolean', description: 'True to mark reviewed, false to revert' },
      },
      required: ['lead_magnet_id', 'reviewed'],
    },
  },
  {
    name: 'magnetlab_review_funnel',
    description:
      'Marks a funnel as reviewed (or un-reviewed) by the DFY editor. Use reviewed: true to approve, reviewed: false to revert.',
    inputSchema: {
      type: 'object',
      properties: {
        funnel_id: { type: 'string', description: 'Funnel UUID to mark as reviewed' },
        reviewed: { type: 'boolean', description: 'True to mark reviewed, false to revert' },
      },
      required: ['funnel_id', 'reviewed'],
    },
  },
  {
    name: 'magnetlab_submit_asset_review',
    description:
      'Submits all reviewed lead magnets and funnels for a team to the client for final review. Fires a DFY callback notifying the client that their assets are ready.',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Team ID whose reviewed assets to submit' },
      },
      required: ['team_id'],
    },
  },
];
