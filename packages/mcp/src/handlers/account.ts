/** Account handler. Dispatches 1 account/team tool to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleAccountTools(
  name: string,
  _args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_teams':
      return client.listTeams();

    default:
      throw new Error(`Unknown account tool: ${name}`);
  }
}
