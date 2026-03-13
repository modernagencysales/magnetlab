/** Lead handler. Dispatches 3 lead management tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleLeadTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_leads':
      return client.listLeads({
        funnelId: args.funnel_id as string | undefined,
        leadMagnetId: args.lead_magnet_id as string | undefined,
        qualified: args.qualified as boolean | undefined,
        search: args.search as string | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      });

    case 'magnetlab_get_lead':
      return client.getLead(args.id as string);

    case 'magnetlab_export_leads':
      return client.exportLeads({
        funnelId: args.funnel_id as string | undefined,
        leadMagnetId: args.lead_magnet_id as string | undefined,
        qualified: args.qualified as boolean | undefined,
      });

    default:
      throw new Error(`Unknown lead tool: ${name}`);
  }
}
