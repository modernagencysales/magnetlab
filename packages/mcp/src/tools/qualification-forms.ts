import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const qualificationFormTools: Tool[] = [
  {
    name: 'magnetlab_list_qualification_forms',
    description:
      'List all qualification forms. These are survey forms attached to funnel pages that filter leads into qualified/unqualified based on their answers.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_get_qualification_form',
    description: 'Get details of a qualification form.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Qualification form UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_create_qualification_form',
    description: 'Create a new qualification form. Add questions to it afterward, then attach it to a funnel page.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Form name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'magnetlab_list_questions',
    description: 'List all questions in a qualification form.',
    inputSchema: {
      type: 'object',
      properties: {
        form_id: { type: 'string', description: 'Qualification form UUID' },
      },
      required: ['form_id'],
    },
  },
  {
    name: 'magnetlab_create_question',
    description: 'Add a question to a qualification form.',
    inputSchema: {
      type: 'object',
      properties: {
        form_id: { type: 'string', description: 'Qualification form UUID' },
        question_text: { type: 'string', description: 'The question text' },
        question_type: {
          type: 'string',
          enum: ['text', 'single_choice', 'multi_choice'],
          description: 'Question type',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Answer options (for choice types)',
        },
        qualifying_answers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Which answers qualify the lead',
        },
        is_required: { type: 'boolean', description: 'Whether the question is required' },
      },
      required: ['form_id', 'question_text', 'question_type'],
    },
  },
]
