/** Creative handler. Dispatches 6 creative swipe-file tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleCreativeTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_create_creative':
      return client.createCreative({
        contentText: args.content_text as string,
        sourcePlatform: args.source_platform as string | undefined,
        sourceUrl: args.source_url as string | undefined,
        sourceAuthor: args.source_author as string | undefined,
        imageUrl: args.image_url as string | undefined,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_list_creatives':
      return client.listCreatives({
        status: args.status as string | undefined,
        sourcePlatform: args.source_platform as string | undefined,
        minScore: args.min_score as number | undefined,
        limit: args.limit as number | undefined,
      });

    case 'magnetlab_run_scanner':
      return client.runScanner();

    case 'magnetlab_configure_scanner':
      return client.configureScanner({
        action: args.action as 'add' | 'remove',
        sourceType: args.source_type as string,
        sourceValue: args.source_value as string,
        priority: args.priority as number | undefined,
      });

    case 'magnetlab_list_recyclable_posts':
      return { message: 'Phase 2 not yet implemented' };

    case 'magnetlab_recycle_post':
      return { message: 'Phase 2 not yet implemented' };

    default:
      throw new Error(`Unknown creative tool: ${name}`);
  }
}
