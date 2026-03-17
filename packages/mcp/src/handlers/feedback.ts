/** Feedback handler. Dispatches 2 analytics/feedback tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleFeedbackTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_performance_insights':
      return client.getPerformanceInsights(args.period as string | undefined);

    case 'magnetlab_get_recommendations':
      return client.getRecommendations();

    default:
      throw new Error(`Unknown feedback tool: ${name}`);
  }
}
