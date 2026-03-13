/** Compound handler. Dispatches 2 compound action tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';
import type { ContentPillar } from '../constants.js';

export async function handleCompoundTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_launch_lead_magnet':
      return client.launchLeadMagnet({
        lead_magnet_id: args.lead_magnet_id as string,
        slug: args.slug as string | undefined,
        funnel_overrides: args.funnel_overrides as Record<string, unknown> | undefined,
        activate_email_sequence: args.activate_email_sequence as boolean | undefined,
      });

    case 'magnetlab_schedule_content_week':
      return client.scheduleContentWeek({
        start_date: args.start_date as string | undefined,
        posts_per_day: args.posts_per_day as number | undefined,
        pillars: args.pillars as ContentPillar[] | undefined,
        auto_approve: args.auto_approve as boolean | undefined,
      });

    default:
      throw new Error(`Unknown compound tool: ${name}`);
  }
}
