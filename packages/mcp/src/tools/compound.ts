/** Compound action tools (2). Multi-step operations that orchestrate several resources. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const compoundTools: Tool[] = [
  {
    name: 'magnetlab_launch_lead_magnet',
    description:
      'Create a lead magnet from scratch, generate its funnel page, and publish it in one atomic operation. Validates content against the archetype schema before starting. Rolls back on failure. Use magnetlab_get_archetype_schema first to know what content fields the archetype requires.',
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
        content: {
          type: 'object',
          description:
            'Full content object matching the archetype schema. Use magnetlab_get_archetype_schema to see required fields.',
        },
        slug: {
          type: 'string',
          description: 'URL slug for the funnel page (lowercase alphanumeric with hyphens)',
        },
        funnel_theme: {
          type: 'string',
          enum: ['dark', 'light', 'modern'],
          description: 'Funnel page theme (default: dark)',
        },
        email_sequence: {
          type: 'object',
          description:
            'Optional email sequence to create and activate. Object with "emails" array, each having subject, body, delay_days.',
          properties: {
            emails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  body: { type: 'string' },
                  delay_days: { type: 'number' },
                },
                required: ['subject', 'body', 'delay_days'],
              },
            },
          },
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['title', 'archetype', 'content', 'slug'],
    },
  },
  {
    name: 'magnetlab_schedule_content_week',
    description:
      'Create multiple agent-authored posts and schedule them across your posting slots for a week. Each post needs at minimum a body. Posts are distributed to available slots starting from the given week.',
    inputSchema: {
      type: 'object',
      properties: {
        posts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              body: { type: 'string', description: 'Post content (required)' },
              title: { type: 'string', description: 'Optional post title' },
              pillar: {
                type: 'string',
                enum: [
                  'moments_that_matter',
                  'teaching_promotion',
                  'human_personal',
                  'collaboration_social_proof',
                ],
                description: 'Content pillar',
              },
              content_type: {
                type: 'string',
                enum: ['story', 'insight', 'tip', 'framework', 'case_study', 'opinion', 'how_to'],
                description: 'Content type',
              },
            },
            required: ['body'],
          },
          description: 'Array of posts to schedule (1-7)',
        },
        week_start: {
          type: 'string',
          description: 'Start date for the week in YYYY-MM-DD format (defaults to next Monday)',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['posts'],
    },
  },
];
