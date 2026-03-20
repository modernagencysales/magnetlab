/** Lead magnet post tools (3). List sender accounts, publish to LinkedIn, launch lead magnet post with auto-campaign. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const leadMagnetPostTools: Tool[] = [
  {
    name: 'magnetlab_list_sender_accounts',
    description:
      'List team members with connected LinkedIn accounts. Returns profile ID, name, and Unipile account ID for each connected member. Use the team_profile_id from this response in publish and launch tools.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_publish_linkedin_post',
    description:
      'Publish a post to LinkedIn on behalf of a team member. Requires a team_profile_id (from magnetlab_list_sender_accounts) and the post text. Returns the LinkedIn post URL. Does NOT create a campaign — use magnetlab_launch_lead_magnet_post for the full flow.',
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: {
          type: 'string',
          description: 'Team profile UUID (from magnetlab_list_sender_accounts)',
        },
        post_text: {
          type: 'string',
          description: 'Full LinkedIn post text to publish',
        },
      },
      required: ['team_profile_id', 'post_text'],
    },
  },
  {
    name: 'magnetlab_launch_lead_magnet_post',
    description:
      "One-shot: publish a LinkedIn post on a team member's account AND auto-create an active post campaign that monitors comments and DMs the lead magnet funnel link. AI generates keywords and DM template from the post text. The most common workflow for distributing lead magnets.",
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: {
          type: 'string',
          description: 'Team profile UUID (from magnetlab_list_sender_accounts)',
        },
        post_text: {
          type: 'string',
          description: 'Full LinkedIn post text to publish',
        },
        funnel_page_id: {
          type: 'string',
          description:
            'Funnel page UUID to include in DMs. Use magnetlab_list_funnels to find published funnels.',
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Override AI-generated keywords for comment matching. Omit to let AI decide.',
        },
        dm_template: {
          type: 'string',
          description:
            'Override AI-generated DM template. Use {{first_name}} and {{funnel_url}} placeholders. Omit to let AI decide.',
        },
        campaign_name: {
          type: 'string',
          description: 'Optional campaign name. Auto-generated if omitted.',
        },
      },
      required: ['team_profile_id', 'post_text'],
    },
  },
];
