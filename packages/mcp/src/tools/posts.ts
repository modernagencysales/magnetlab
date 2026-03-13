/** Content pipeline post tools (6). List, get, create, update, delete, publish. */

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
      'Create a new post directly. Requires a body at minimum. Optionally specify title, content pillar, and content type.',
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
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
];
