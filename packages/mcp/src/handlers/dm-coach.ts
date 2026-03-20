/** DM Coach handler. Dispatches 7 DM Coach tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleDmCoachTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_dm_contacts': {
      const params: Record<string, string> = {};
      if (args.status) params.status = args.status as string;
      if (args.goal) params.goal = args.goal as string;
      if (args.search) params.search = args.search as string;
      return client.listDmContacts(params);
    }

    case 'magnetlab_get_dm_contact':
      return client.getDmContact(args.contact_id as string);

    case 'magnetlab_create_dm_contact': {
      const { ...input } = args;
      return client.createDmContact(input);
    }

    case 'magnetlab_update_dm_contact': {
      const { contact_id, ...updates } = args;
      return client.updateDmContact(contact_id as string, updates);
    }

    case 'magnetlab_delete_dm_contact':
      return client.deleteDmContact(args.contact_id as string);

    case 'magnetlab_add_dm_messages':
      return client.addDmMessages(
        args.contact_id as string,
        args.messages as Array<Record<string, unknown>>
      );

    case 'magnetlab_dm_coach_suggest':
      return client.dmCoachSuggest(args.contact_id as string);

    default:
      throw new Error(`Unknown DM Coach tool: ${name}`);
  }
}
