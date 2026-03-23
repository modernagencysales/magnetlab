/** Content pipeline post tools (8). List, get, create, update, delete, publish, upload_image_url, publish_to_linkedin. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const postTools: Tool[] = [
  {
    name: 'magnetlab_list_posts',
    description:
      'List posts in the content pipeline. Filter by status or buffer status. Returns title, body preview, status, and scheduling info.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'],
          description: 'Filter by post status',
        },
        is_buffer: {
          type: 'boolean',
          description: 'Filter for buffer posts only (true) or non-buffer (false)',
        },
        limit: { type: 'number', default: 50, description: 'Max results (1-100)' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_post',
    description:
      'Get full details of a pipeline post including draft and final content, hook score, polish notes, and scheduling info.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_create_post',
    description:
      'Create a new post directly. Requires a body at minimum. Optionally specify title, content pillar, content type, image URL, and lead magnet post automation flags.',
    inputSchema: {
      type: 'object',
      properties: {
        body: { type: 'string', description: 'Post body text' },
        title: { type: 'string', description: 'Optional title/label for the post' },
        pillar: {
          type: 'string',
          enum: [
            'moments_that_matter',
            'teaching_promotion',
            'human_personal',
            'collaboration_social_proof',
          ],
          description: 'Content pillar category',
        },
        content_type: {
          type: 'string',
          enum: [
            'story',
            'insight',
            'tip',
            'framework',
            'case_study',
            'question',
            'listicle',
            'contrarian',
          ],
          description: 'Content type',
        },
        image_url: {
          type: 'string',
          description: 'URL of image to attach to the post',
        },
        is_lead_magnet_post: {
          type: 'boolean',
          description:
            'When true, triggers auto-setup of a post campaign on publish to capture leads from comments',
        },
        auto_activate: {
          type: 'boolean',
          description:
            'When true and is_lead_magnet_post is true, auto-activates the campaign if AI confidence is high',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['body'],
    },
  },
  {
    name: 'magnetlab_update_post',
    description:
      'Update a pipeline post. Can change content, status, scheduling, or metadata. Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
        draft_content: { type: 'string', description: 'Updated draft content' },
        final_content: { type: 'string', description: 'Updated final content' },
        status: {
          type: 'string',
          enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'],
          description: 'New post status',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_delete_post',
    description: 'Delete a pipeline post.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_publish_post',
    description:
      'Publish a pipeline post immediately. Marks the post as published and triggers connected integrations (e.g. LinkedIn publishing).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
        unipile_account_id: {
          type: 'string',
          description: 'Override: publish from this Unipile account instead of the default',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_upload_post_image',
    description:
      'Upload an image to a pipeline post from an external URL. The image will be attached when the post is published.',
    inputSchema: {
      type: 'object' as const,
      required: ['post_id', 'image_url'],
      properties: {
        post_id: { type: 'string', description: 'Pipeline post ID' },
        image_url: { type: 'string', description: 'External image URL to download and store' },
        team_id: { type: 'string', description: 'Team ID for scoping' },
      },
    },
  },
  {
    name: 'magnetlab_publish_to_linkedin',
    description:
      'Publish a post directly to LinkedIn on a specific account. Creates a DB record and publishes in one call.',
    inputSchema: {
      type: 'object' as const,
      required: ['unipile_account_id', 'text'],
      properties: {
        unipile_account_id: { type: 'string', description: 'Unipile account ID to post from' },
        text: { type: 'string', description: 'Post body text' },
        image_url: { type: 'string', description: 'External image URL to download and attach' },
        title: { type: 'string', description: 'Internal label (not shown on LinkedIn)' },
        team_id: { type: 'string', description: 'Team ID for scoping' },
      },
    },
  },
  {
    name: 'magnetlab_list_linkedin_accounts',
    description:
      'List all connected LinkedIn accounts (via Unipile) for the current user. Returns account IDs, names, and connection status. Pass refresh=true to verify live status with Unipile API (slower).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        team_id: { type: 'string', description: 'Team ID for scoping' },
        refresh: {
          type: 'boolean',
          description: 'If true, verify live status with Unipile API. Default: false.',
        },
      },
    },
  },
];
