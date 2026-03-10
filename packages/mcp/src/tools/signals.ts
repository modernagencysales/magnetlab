import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const signalTools: Tool[] = [
  {
    name: 'magnetlab_import_prospects',
    description:
      'Import prospects into the signal engine as signal leads. Accepts an array of prospects with LinkedIn URLs and optional custom data (authority_score, monthly_income, etc.). Upserts on user_id + linkedin_url.',
    inputSchema: {
      type: 'object',
      properties: {
        prospects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
              full_name: { type: 'string', description: 'Full name' },
              company: { type: 'string', description: 'Company name', nullable: true },
              prospect_id: {
                type: 'string',
                description: 'Original prospect ID for linking',
                nullable: true,
              },
              custom_data: {
                type: 'object',
                description: 'Custom scoring data (authority_score, monthly_income, etc.)',
              },
            },
            required: ['linkedin_url'],
          },
          description: 'Array of prospects to import (max 500)',
          minItems: 1,
          maxItems: 500,
        },
      },
      required: ['prospects'],
    },
  },
  {
    name: 'magnetlab_list_signal_variables',
    description:
      'List all custom scoring variables configured for the current user. Returns variable definitions with their scoring rules.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_create_signal_variable',
    description:
      'Create or update a custom scoring variable. Variables define how custom_data fields contribute to compound scores. Types: number (range-based), text (keyword matching), boolean (true/false weights).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Variable name (matches custom_data key)' },
        field_type: {
          type: 'string',
          enum: ['number', 'text', 'boolean'],
          description: 'Data type of the variable',
        },
        scoring_rule: {
          type: 'object',
          description:
            'Scoring rule. Number: {ranges: [{min, max?, weight}]}. Boolean: {when_true, when_false}. Text: {contains: {keyword: weight}, default: weight}.',
        },
        display_order: { type: 'number', description: 'Display order (optional)' },
      },
      required: ['name', 'field_type', 'scoring_rule'],
    },
  },
  {
    name: 'magnetlab_signal_recommendations',
    description:
      'Get top signal leads ranked by compound score for outreach. Returns leads with their signal events, custom data, and scores. Use this to find the best prospects to reach out to today.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max leads to return (1-50, default 10)' },
        min_score: { type: 'number', description: 'Minimum compound score filter' },
      },
    },
  },
];
