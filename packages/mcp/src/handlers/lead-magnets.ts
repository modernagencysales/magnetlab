import { MagnetLabClient } from '../client.js';
import type { Archetype, LeadMagnetStatusV2 } from '../constants.js';

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
        status: args.status as LeadMagnetStatusV2 | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      });

    case 'magnetlab_get_lead_magnet':
      return client.getLeadMagnet(args.id as string);

    case 'magnetlab_create_lead_magnet': {
      // Brain enrichment: search + synthesize + merge
      let finalConcept = (args.concept as Record<string, unknown>) || {};
      let brainMeta: { brain_entries_used?: number; position_used?: boolean } = {};

      if (args.use_brain) {
        const brainResult = await enrichFromBrain(
          client,
          args.title as string,
          args.brain_query as string | undefined,
          args.knowledge_entry_ids as string[] | undefined
        );

        // Merge: manual concept fields take priority over brain-derived
        finalConcept = mergeConcepts(brainResult.concept, finalConcept);
        brainMeta = {
          brain_entries_used: brainResult.brain_entries_used,
          position_used: brainResult.position_used,
        };
      }

      const leadMagnet = await client.createLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        concept: args.concept as unknown,
      });

    case 'magnetlab_delete_lead_magnet':
      return client.deleteLeadMagnet(args.id as string);

    case 'magnetlab_get_lead_magnet_stats':
      return client.getLeadMagnetStats(args.lead_magnet_id as string);

    case 'magnetlab_analyze_competitor':
      return client.analyzeCompetitor({ url: args.url as string });

    case 'magnetlab_analyze_transcript':
      return client.analyzeTranscript({ transcript: args.transcript as string });

    default:
      throw new Error(`Unknown lead magnet tool: ${name}`);
  }
}
