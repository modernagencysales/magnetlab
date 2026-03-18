/** Email handler. Dispatches 3 email sequence tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';
import type { EmailSequenceStatus } from '../constants.js';

export async function handleEmailTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_email_sequence':
      return client.getEmailSequence(
        args.lead_magnet_id as string,
        args.team_id as string | undefined
      );

    case 'magnetlab_save_email_sequence':
      return client.saveEmailSequence(
        args.lead_magnet_id as string,
        {
          emails: args.emails as
            | Array<{ day: number; subject: string; body: string; replyTrigger?: string }>
            | undefined,
          status: args.status as EmailSequenceStatus | undefined,
        },
        args.team_id as string | undefined
      );

    case 'magnetlab_activate_email_sequence':
      return client.activateEmailSequence(
        args.lead_magnet_id as string,
        args.team_id as string | undefined
      );

    default:
      throw new Error(`Unknown email tool: ${name}`);
  }
}
