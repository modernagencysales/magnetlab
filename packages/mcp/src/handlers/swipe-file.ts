import { MagnetLabClient } from '../client.js'

/**
 * Handle swipe file tool calls.
 */
export async function handleSwipeFileTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_browse_swipe_posts':
      return client.browseSwipeFilePosts({
        niche: args.niche as string | undefined,
        type: args.type as string | undefined,
        featured: args.featured as boolean | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      })

    case 'magnetlab_browse_swipe_lead_magnets':
      return client.browseSwipeFileLeadMagnets({
        niche: args.niche as string | undefined,
        format: args.format as string | undefined,
        featured: args.featured as boolean | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      })

    case 'magnetlab_submit_to_swipe_file':
      return client.submitToSwipeFile({
        content: args.content as string,
        type: args.type as string,
        niche: args.niche as string,
      })

    default:
      throw new Error(`Unknown swipe file tool: ${name}`)
  }
}
