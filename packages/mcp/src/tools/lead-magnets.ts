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
        limit: { type: 'number', default: 20, description: 'Max results to return (1-100)' },
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
      'Create a new lead magnet. Choose an archetype and provide a title. ' +
      'A lead magnet alone is NOT publicly accessible — you must also create a funnel page. ' +
      'Two options: (1) pass funnel_config here to create both in one call, or ' +
      '(2) call magnetlab_create_funnel separately after. ' +
      'Without a funnel, the lead magnet exists only as a draft in the library.',
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
        funnel_config: {
          type: 'object',
          description:
            'Optional. Creates a funnel page for this lead magnet in the same call. ' +
            'If omitted, no funnel is created — use magnetlab_create_funnel separately. ' +
            'Defaults: headline=lead magnet title, button="Get Free Access", theme="dark", ' +
            'color="#8b5cf6", social_proof=null (do NOT fabricate).',
          properties: {
            slug: {
              type: 'string',
              description: 'URL slug (e.g. "my-free-guide"). Auto-generated from title if omitted.',
            },
            optin_headline: {
              type: 'string',
              description: 'Main headline (default: lead magnet title)',
            },
            optin_subline: { type: 'string', description: 'Subheadline text (default: null)' },
            optin_button_text: {
              type: 'string',
              description: 'CTA button text (default: "Get Free Access")',
            },
            optin_social_proof: {
              type: 'string',
              description:
                'Social proof line. Null if omitted — use real data only, never fabricate.',
            },
            thankyou_headline: {
              type: 'string',
              description: 'Thank you page headline (default: "Thanks! Check your email.")',
            },
            thankyou_subline: {
              type: 'string',
              description: 'Thank you page subheadline (default: null)',
            },
            theme: {
              type: 'string',
              enum: ['light', 'dark'],
              description: 'Page theme (default: dark or brand kit)',
            },
            primary_color: {
              type: 'string',
              description: 'Accent color hex (default: #8b5cf6 or brand kit)',
            },
            background_style: {
              type: 'string',
              enum: ['solid', 'gradient', 'pattern'],
              description: 'Background style (default: solid)',
            },
            vsl_url: { type: 'string', description: 'Video URL for thank-you page' },
            calendly_url: {
              type: 'string',
              description: 'Calendly URL for booking on thank-you page',
            },
            logo_url: { type: 'string', description: 'Logo image URL' },
            qualification_form_id: {
              type: 'string',
              description: 'Qualification form UUID to attach',
            },
            publish: {
              type: 'boolean',
              description: 'Publish immediately after creation (default: false)',
            },
          },
        },
      },
      required: ['title', 'archetype'],
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
    name: 'magnetlab_generate_lead_magnet_posts',
    description:
      'Generate LinkedIn promotion posts (3 variations + DM template + CTA word) for an existing lead magnet that has content but is missing posts. The lead magnet must have polished_content or extracted_content.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
      },
      required: ['lead_magnet_id'],
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
