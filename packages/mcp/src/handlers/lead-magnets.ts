/** Lead magnet handler. Dispatches 5 lead magnet tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';
import type { Archetype, LeadMagnetStatusV2 } from '../constants.js';

export async function handleLeadMagnetTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_lead_magnets':
      return client.listLeadMagnets({
        status: args.status as LeadMagnetStatusV2 | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      });

    case 'magnetlab_get_lead_magnet':
      return client.getLeadMagnet(args.id as string);

    case 'magnetlab_create_lead_magnet':
      return client.createLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        concept: args.concept as Record<string, unknown> | undefined,
      });

    case 'magnetlab_update_lead_magnet':
      return client.updateLeadMagnetContent(
        args.id as string,
        args.content as Record<string, unknown>,
        args.expected_version as number | undefined
      );

    case 'magnetlab_delete_lead_magnet':
      return client.deleteLeadMagnet(args.id as string);

    default:
      throw new Error(`Unknown lead magnet tool: ${name}`);
  }
}
