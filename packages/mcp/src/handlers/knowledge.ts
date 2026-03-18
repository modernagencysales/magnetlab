/** Knowledge handler. Dispatches 5 knowledge/transcript tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';
import type { KnowledgeCategory, KnowledgeType } from '../constants.js';

export async function handleKnowledgeTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_search_knowledge':
      return client.searchKnowledge({
        query: args.query as string | undefined,
        category: args.category as KnowledgeCategory | undefined,
        type: args.type as KnowledgeType | undefined,
        topic: args.topic as string | undefined,
        min_quality: args.min_quality as number | undefined,
        since: args.since as string | undefined,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_browse_knowledge':
      return client.browseKnowledge({
        category: args.category as KnowledgeCategory | undefined,
        tag: args.tag as string | undefined,
        limit: args.limit as number | undefined,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_get_knowledge_clusters':
      return client.getKnowledgeClusters(args.team_id as string | undefined);

    case 'magnetlab_ask_knowledge':
      return client.askKnowledge({
        question: args.question as string,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_submit_transcript':
      return client.submitTranscript({
        transcript: args.transcript as string,
        title: args.title as string | undefined,
        teamId: args.team_id as string | undefined,
      });

    default:
      throw new Error(`Unknown knowledge tool: ${name}`);
  }
}
