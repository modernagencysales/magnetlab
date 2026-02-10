import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const swipeFileTools: Tool[] = [
  {
    name: 'magnetlab_browse_swipe_posts',
    description:
      'Browse the community swipe file of high-performing LinkedIn posts. Filter by niche, post type, or featured status. Great for inspiration.',
    inputSchema: {
      type: 'object',
      properties: {
        niche: { type: 'string', description: 'Filter by niche/industry' },
        type: {
          type: 'string',
          description: 'Filter by post type (e.g. hook, story, educational, promotional, engagement)',
        },
        featured: { type: 'boolean', description: 'Only show featured/top posts' },
        limit: { type: 'number', default: 20, description: 'Max results (1-50)' },
        offset: { type: 'number', default: 0, description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'magnetlab_browse_swipe_lead_magnets',
    description:
      'Browse the community swipe file of lead magnet examples. Filter by niche or format. See what lead magnets are working for others.',
    inputSchema: {
      type: 'object',
      properties: {
        niche: { type: 'string', description: 'Filter by niche/industry' },
        format: { type: 'string', description: 'Filter by lead magnet format' },
        featured: { type: 'boolean', description: 'Only show featured examples' },
        limit: { type: 'number', default: 20, description: 'Max results (1-50)' },
        offset: { type: 'number', default: 0, description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'magnetlab_submit_to_swipe_file',
    description: 'Submit content to the community swipe file. Posts are reviewed before being made public.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The post content to share' },
        type: { type: 'string', description: 'Post type category' },
        niche: { type: 'string', description: 'Your niche/industry' },
      },
      required: ['content', 'type', 'niche'],
    },
  },
]
