import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const ideationTools: Tool[] = [
  {
    name: 'magnetlab_ideate_lead_magnets',
    description:
      'Generate lead magnet ideas based on your business context. Requires businessDescription and businessType at minimum. Returns a background job ID that you can poll with magnetlab_get_job_status. Ideas are generated using AI and saved to your brand kit.',
    inputSchema: {
      type: 'object',
      properties: {
        business_description: {
          type: 'string',
          description: 'What your business does and who you serve',
        },
        business_type: {
          type: 'string',
          description: 'Business category (e.g. "B2B SaaS", "Agency", "Coaching")',
        },
        credibility_markers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Social proof, credentials, results (e.g. "Helped 200+ agencies scale")',
        },
        urgent_pains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Top pain points your audience has',
        },
        templates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Templates/frameworks you use with clients',
        },
        processes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key processes or methods you follow',
        },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools or software you recommend',
        },
        frequent_questions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Questions your prospects frequently ask',
        },
        results: {
          type: 'array',
          items: { type: 'string' },
          description: 'Typical results/outcomes you deliver',
        },
        success_example: {
          type: 'string',
          description: 'A specific client success story',
        },
      },
      required: ['business_description', 'business_type'],
    },
  },
  {
    name: 'magnetlab_extract_content',
    description:
      'Run AI content extraction for a lead magnet. Provide the archetype, concept (from ideation), and answers to extraction questions. Returns the extracted structured content.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
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
        concept: { type: 'object', description: 'The concept object from ideation' },
        answers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Key-value map of extraction question IDs to user answers',
        },
      },
      required: ['lead_magnet_id', 'archetype', 'concept', 'answers'],
    },
  },
  {
    name: 'magnetlab_generate_content',
    description:
      'Generate the final lead magnet content from extraction data. Provide the archetype, concept, and answers. Returns structured content ready for publishing.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
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
        concept: { type: 'object', description: 'The concept object from ideation' },
        answers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Key-value map of extraction question IDs to user answers',
        },
      },
      required: ['lead_magnet_id', 'archetype', 'concept', 'answers'],
    },
  },
  {
    name: 'magnetlab_write_linkedin_posts',
    description:
      'Generate 3 LinkedIn post variations to promote a lead magnet. Returns hooks, bodies, and CTAs optimized for LinkedIn engagement.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
        lead_magnet_title: { type: 'string', description: 'Title of the lead magnet' },
        contents: { type: 'string', description: 'Summary of what the lead magnet contains' },
        problem_solved: { type: 'string', description: 'The core problem this lead magnet solves' },
      },
      required: ['lead_magnet_id', 'lead_magnet_title', 'contents', 'problem_solved'],
    },
  },
  {
    name: 'magnetlab_polish_lead_magnet',
    description:
      'Polish/refine the generated content for a lead magnet. Improves formatting, readability, and impact. Runs AI enhancement on the extracted content.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID' },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_get_job_status',
    description:
      'Check the status of a background job (e.g. ideation, content generation). Returns current status and result when complete.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Background job UUID' },
      },
      required: ['job_id'],
    },
  },
]
