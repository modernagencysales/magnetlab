/** Compound action tools (2). Multi-step operations that orchestrate several resources. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const compoundTools: Tool[] = [
  {
    name: 'magnetlab_launch_lead_magnet',
    description:
      'Create a lead magnet, generate its funnel page, and publish it in one atomic operation. Validates content against the archetype schema before starting. Rolls back on failure.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: {
          type: 'string',
          description: 'Lead magnet UUID to launch (must already exist with content)',
        },
        slug: {
          type: 'string',
          description:
            'URL slug for the funnel page (optional — auto-generated from title if omitted)',
        },
        funnel_overrides: {
          type: 'object',
          description:
            'Optional funnel customizations: optin_headline, optin_subline, theme, primary_color, etc.',
        },
        activate_email_sequence: {
          type: 'boolean',
          description:
            'Whether to activate the email sequence as part of the launch (default: false)',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['lead_magnet_id'],
    },
  },
  {
    name: 'magnetlab_schedule_content_week',
    description:
      'Create multiple posts and schedule them across your posting slots for a week. Each post needs at minimum a body. Posts are distributed to available slots starting from the given week.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for the week in YYYY-MM-DD format (defaults to next Monday)',
        },
        posts_per_day: {
          type: 'number',
          description: 'Max posts per day (default: 1)',
        },
        pillars: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'moments_that_matter',
              'teaching_promotion',
              'human_personal',
              'collaboration_social_proof',
            ],
          },
          description: 'Content pillars to focus on (default: balanced mix)',
        },
        auto_approve: {
          type: 'boolean',
          description: 'Auto-approve generated posts for scheduling (default: false)',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
];
