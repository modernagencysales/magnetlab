import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const leadMagnetTools: Tool[] = [
  {
    name: 'magnetlab_list_lead_magnets',
    description:
      'List all lead magnets for the current user. Returns title, archetype, status, and creation date. Use the status filter to find drafts, published, or in-progress lead magnets.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'extracting', 'generating', 'content_ready', 'complete', 'published'],
          description: 'Filter by lead magnet status',
        },
        limit: { type: 'number', default: 50, description: 'Max results to return (1-100)' },
        offset: { type: 'number', default: 0, description: 'Offset for pagination' },
      },
    },
  },
  {
    name: 'magnetlab_get_lead_magnet',
    description:
      'Get full details of a single lead magnet including its concept, extracted content, generated content, LinkedIn posts, post variations, DM template, and CTA word.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead magnet UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_create_lead_magnet',
    description:
      'Create a new lead magnet. Choose an archetype (e.g. single-breakdown, focused-toolkit, assessment) and provide a title. Optionally include concept data, extracted content, or post variations if pre-generated.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Lead magnet title' },
        archetype: {
          type: 'string',
          enum: [
            'single-breakdown',
            'single-system',
            'focused-toolkit',
            'single-calculator',
            'focused-directory',
            'mini-training',
            'one-story',
            'prompt',
            'assessment',
            'workflow',
          ],
          description: 'Content archetype/format',
        },
        concept: { type: 'object', description: 'Concept data (optional, from ideation)' },
        external_url: {
          type: 'string',
          description:
            'External URL for the lead magnet resource (e.g. Notion page, PDF, external site). If set, delivery links point here instead of hosted content.',
        },
      },
      required: ['title', 'archetype'],
    },
  },
  {
    name: 'magnetlab_update_lead_magnet',
    description:
      'Update an existing lead magnet. Change title, external URL, status, or other fields. Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead magnet UUID' },
        title: { type: 'string', description: 'New title' },
        external_url: { type: 'string', description: 'External URL for the resource' },
        archetype: {
          type: 'string',
          enum: [
            'single-breakdown',
            'single-system',
            'focused-toolkit',
            'single-calculator',
            'focused-directory',
            'mini-training',
            'one-story',
            'prompt',
            'assessment',
            'workflow',
          ],
          description: 'Content archetype/format',
        },
        status: {
          type: 'string',
          enum: ['draft', 'extracting', 'generating', 'content_ready', 'complete', 'published'],
          description: 'Lead magnet status',
        },
        pain_point: { type: 'string', description: 'Pain point the lead magnet solves' },
        target_audience: { type: 'string', description: 'Target audience description' },
        short_description: { type: 'string', description: 'Short description for catalog' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_delete_lead_magnet',
    description:
      'Permanently delete a lead magnet. This also removes associated funnel pages and leads.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead magnet UUID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_get_lead_magnet_stats',
    description:
      'Get performance statistics for a specific lead magnet: page views, leads captured, and conversion rate.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_analyze_competitor',
    description:
      'Analyze a competitor URL to extract insights for lead magnet ideation. Provide a URL to a landing page, lead magnet, or content piece.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the competitor content to analyze' },
      },
      required: ['url'],
    },
  },
  {
    name: 'magnetlab_analyze_transcript',
    description:
      'Analyze a sales call or podcast transcript to extract lead magnet ideas, pain points, and content themes.',
    inputSchema: {
      type: 'object',
      properties: {
        transcript: { type: 'string', description: 'Full text of the transcript to analyze' },
      },
      required: ['transcript'],
    },
  },
];
