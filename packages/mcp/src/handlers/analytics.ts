import { MagnetLabClient } from '../client.js'

/**
 * Handle analytics tool calls.
 */
export async function handleAnalyticsTools(
  name: string,
  _args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_funnel_stats':
      return client.getFunnelStats()

    default:
      throw new Error(`Unknown analytics tool: ${name}`)
  }
}
