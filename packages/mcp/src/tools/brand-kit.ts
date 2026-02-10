import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const brandKitTools: Tool[] = [
  {
    name: 'magnetlab_get_brand_kit',
    description:
      'Get the user\'s brand kit / business context. Returns business description, type, credibility markers, pain points, templates, processes, tools, questions, results, tone, style profile, and any saved ideation results.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_update_brand_kit',
    description:
      'Create or update the user\'s brand kit. This is the foundation for AI-powered ideation and content generation. Provide as much business context as possible for better results.',
    inputSchema: {
      type: 'object',
      properties: {
        business_description: { type: 'string', description: 'What your business does and who you serve' },
        business_type: { type: 'string', description: 'Business category (e.g. "B2B SaaS", "Agency")' },
        credibility_markers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Social proof and credentials',
        },
        urgent_pains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Top audience pain points',
        },
        templates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Templates/frameworks you use',
        },
        processes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key processes or methods',
        },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools you recommend',
        },
        frequent_questions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Common prospect questions',
        },
        results: {
          type: 'array',
          items: { type: 'string' },
          description: 'Typical outcomes you deliver',
        },
        success_example: { type: 'string', description: 'A specific client success story' },
        audience_tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools your audience currently uses',
        },
        preferred_tone: {
          type: 'string',
          description: 'Writing tone (e.g. "conversational", "professional", "bold")',
        },
        style_profile: {
          type: 'object',
          description: 'Advanced style profile settings (AI-extracted)',
        },
      },
    },
  },
  {
    name: 'magnetlab_extract_business_context',
    description:
      'Extract business context from unstructured content (e.g. an offer document, LinkedIn about section, or sales page). Paste the text and the AI will parse out business description, pain points, credibility markers, etc. to populate your brand kit.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The raw text to extract business context from (min 50 characters)',
        },
        content_type: {
          type: 'string',
          enum: ['offer-doc', 'linkedin', 'sales-page', 'other'],
          description: 'Type of content for better extraction (optional)',
        },
      },
      required: ['content'],
    },
  },
]
