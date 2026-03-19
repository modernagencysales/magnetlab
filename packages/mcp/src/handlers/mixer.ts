/** Mixer handler. Dispatches 4 ingredient mixer tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleMixerTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_ingredient_inventory':
      return client.getIngredientInventory(args.team_profile_id as string);

    case 'magnetlab_get_suggested_recipes':
      return client.getSuggestedRecipes(
        args.team_profile_id as string,
        args.limit as number | undefined
      );

    case 'magnetlab_mix':
      return client.mix({
        team_profile_id: args.team_profile_id as string,
        exploit_id: args.exploit_id as string | undefined,
        knowledge_topic: args.knowledge_topic as string | undefined,
        knowledge_query: args.knowledge_query as string | undefined,
        style_id: args.style_id as string | undefined,
        template_id: args.template_id as string | undefined,
        creative_id: args.creative_id as string | undefined,
        trend_topic: args.trend_topic as string | undefined,
        recycled_post_id: args.recycled_post_id as string | undefined,
        idea_id: args.idea_id as string | undefined,
        hook: args.hook as string | undefined,
        instructions: args.instructions as string | undefined,
        count: args.count as number | undefined,
        output: args.output as 'drafts' | 'ideas' | undefined,
      });

    case 'magnetlab_get_combo_performance':
      return client.getComboPerformance(
        args.team_profile_id as string,
        args.limit as number | undefined
      );

    default:
      throw new Error(`Unknown mixer tool: ${name}`);
  }
}
