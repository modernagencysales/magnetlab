import { Tool } from '@modelcontextprotocol/sdk/types.js';

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
    description:
      'Create a new qualification form. Add questions to it afterward, then attach it to a funnel page.',
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
        answer_type: {
          type: 'string',
          enum: ['yes_no', 'text', 'textarea', 'multiple_choice'],
          description: 'Answer type: yes_no, text, textarea, or multiple_choice',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Answer options (required for multiple_choice, at least 2)',
        },
        qualifying_answer: {
          description:
            'Which answer(s) qualify the lead. String for yes_no ("yes"/"no"), array of strings for multiple_choice.',
        },
        is_qualifying: {
          type: 'boolean',
          description: 'Whether this question is used to qualify leads (default: true for yes_no)',
        },
        is_required: {
          type: 'boolean',
          description: 'Whether the question is required (default: true)',
        },
      },
      required: ['form_id', 'question_text', 'answer_type'],
    },
  },
];
