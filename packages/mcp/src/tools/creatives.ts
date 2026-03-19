/** Creative swipe-file tools (6). Ingest, list, scan, configure scanner, recycle (Phase 2 stubs). */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const creativeTools: Tool[] = [
  {
    name: 'magnetlab_create_creative',
    description:
      'Ingest external content (a LinkedIn post, article, or other source) into the creative swipe file. The content is stored and scored for later use as inspiration when generating posts.',
    inputSchema: {
      type: 'object',
      properties: {
        content_text: {
          type: 'string',
          description: 'Full text of the content to ingest',
        },
        source_platform: {
          type: 'string',
          description: 'Platform the content came from (e.g. "linkedin", "twitter", "newsletter")',
        },
        source_url: {
          type: 'string',
          description: 'URL of the original content',
        },
        source_author: {
          type: 'string',
          description: 'Name or handle of the original author',
        },
        image_url: {
          type: 'string',
          description: 'URL of an image associated with the content',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['content_text'],
    },
  },
  {
    name: 'magnetlab_list_creatives',
    description:
      'List ingested creatives from the swipe file. Filter by analysis status, source platform, or minimum quality score.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'analyzed', 'failed'],
          description: 'Filter by analysis status',
        },
        source_platform: {
          type: 'string',
          description: 'Filter by source platform (e.g. "linkedin", "twitter")',
        },
        min_score: {
          type: 'number',
          description: 'Minimum quality/virality score (0-100)',
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Max results (1-100)',
        },
      },
    },
  },
  {
    name: 'magnetlab_run_scanner',
    description:
      'Trigger a manual content scan. The scanner searches configured sources (search terms, hashtags, creators, competitors) for high-performing content to ingest as creatives.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_configure_scanner',
    description:
      'Add or remove a source from the LinkedIn content scanner. Sources can be search terms, hashtags, creator profiles, or competitor accounts to monitor for high-performing content.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'remove'],
          description: 'Whether to add or remove this source',
        },
        source_type: {
          type: 'string',
          enum: ['search_term', 'hashtag', 'creator', 'competitor'],
          description: 'Type of source to monitor',
        },
        source_value: {
          type: 'string',
          description: 'The value to monitor (e.g. "cold outreach", "#b2bsales", "johndoe")',
        },
        priority: {
          type: 'number',
          description: 'Priority level for this source (higher = scanned more frequently)',
        },
      },
      required: ['action', 'source_type', 'source_value'],
    },
  },
  {
    name: 'magnetlab_list_recyclable_posts',
    description:
      '[Phase 2] List previously published posts that are candidates for recycling or creating cousin posts. Not yet implemented.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          default: 20,
          description: 'Max results',
        },
      },
    },
  },
  {
    name: 'magnetlab_recycle_post',
    description:
      '[Phase 2] Recycle a published post as a repost or generate a "cousin" post using the same structure with fresh content. Not yet implemented.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'UUID of the published post to recycle',
        },
        type: {
          type: 'string',
          enum: ['repost', 'cousin'],
          description:
            '"repost" republishes the original; "cousin" generates a new post with the same format but fresh content',
        },
      },
      required: ['post_id', 'type'],
    },
  },
];
