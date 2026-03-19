/** LinkedIn activity handler. Dispatches 1 LinkedIn activity tool to MagnetLabClient method. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleLinkedInActivityTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_linkedin_activity':
      return client.getLinkedInActivity(args);

    default:
      throw new Error(`Unknown LinkedIn activity tool: ${name}`);
  }
}
