import { MagnetLabClient } from '../client.js'
import type { Archetype, LeadMagnetStatus } from '../constants.js'

/**
 * Handle lead magnet related tool calls.
 */
export async function handleLeadMagnetTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_lead_magnets':
      return client.listLeadMagnets({
        status: args.status as LeadMagnetStatus | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      })

    case 'magnetlab_get_lead_magnet':
      return client.getLeadMagnet(args.id as string)

    case 'magnetlab_create_lead_magnet':
      return client.createLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        concept: args.concept as unknown,
      })

    case 'magnetlab_delete_lead_magnet':
      return client.deleteLeadMagnet(args.id as string)

    case 'magnetlab_get_lead_magnet_stats':
      return client.getLeadMagnetStats(args.lead_magnet_id as string)

    case 'magnetlab_analyze_competitor':
      return client.analyzeCompetitor({ url: args.url as string })

    case 'magnetlab_analyze_transcript':
      return client.analyzeTranscript({ transcript: args.transcript as string })

    default:
      throw new Error(`Unknown lead magnet tool: ${name}`)
  }
}
