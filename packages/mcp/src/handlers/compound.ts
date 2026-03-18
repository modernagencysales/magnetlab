/** Compound handler. Dispatches 2 compound action tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';
import type { Archetype, ContentPillar, ContentType } from '../constants.js';

export async function handleCompoundTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_launch_lead_magnet':
      return client.launchLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        content: args.content as Record<string, unknown>,
        slug: args.slug as string,
        funnel_theme: args.funnel_theme as string | undefined,
        email_sequence: args.email_sequence as
          | { emails: Array<{ subject: string; body: string; delay_days: number }> }
          | undefined,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_schedule_content_week':
      return client.scheduleContentWeek(
        {
          posts: args.posts as Array<{
            body: string;
            title?: string;
            pillar?: ContentPillar;
            content_type?: ContentType;
          }>,
          week_start: args.week_start as string | undefined,
        },
        args.team_id as string | undefined
      );

    default:
      throw new Error(`Unknown compound tool: ${name}`);
  }
}
