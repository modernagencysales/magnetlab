/** Outreach campaign handler. Dispatches 11 outreach campaign tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleOutreachCampaignTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_create_outreach_campaign':
      return client.createOutreachCampaign({
        name: args.name as string,
        preset: args.preset as string,
        account_id: args.account_id as string,
        first_message_template: args.first_message_template as string,
        connect_message: args.connect_message as string | undefined,
        follow_up_template: args.follow_up_template as string | undefined,
        follow_up_delay_days: args.follow_up_delay_days as number | undefined,
        withdraw_delay_days: args.withdraw_delay_days as number | undefined,
      });

    case 'magnetlab_list_outreach_campaigns':
      return client.listOutreachCampaigns(args.status as string | undefined);

    case 'magnetlab_get_outreach_campaign':
      return client.getOutreachCampaign(args.campaign_id as string);

    case 'magnetlab_update_outreach_campaign': {
      const { campaign_id, ...updates } = args;
      return client.updateOutreachCampaign(campaign_id as string, updates);
    }

    case 'magnetlab_activate_outreach_campaign':
      return client.activateOutreachCampaign(args.campaign_id as string);

    case 'magnetlab_pause_outreach_campaign':
      return client.pauseOutreachCampaign(args.campaign_id as string);

    case 'magnetlab_delete_outreach_campaign':
      return client.deleteOutreachCampaign(args.campaign_id as string);

    case 'magnetlab_add_outreach_leads':
      return client.addOutreachLeads(
        args.campaign_id as string,
        args.leads as Array<Record<string, unknown>>
      );

    case 'magnetlab_list_outreach_leads':
      return client.listOutreachLeads(
        args.campaign_id as string,
        args.status as string | undefined
      );

    case 'magnetlab_get_outreach_lead':
      return client.getOutreachLead(args.lead_id as string);

    case 'magnetlab_skip_outreach_lead':
      return client.skipOutreachLead(args.lead_id as string);

    default:
      throw new Error(`Unknown outreach campaign tool: ${name}`);
  }
}
