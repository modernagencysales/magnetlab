import { MagnetLabClient } from '../client.js';

/**
 * Handle signal intelligence tool calls.
 */
export async function handleSignalTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_import_prospects':
      return client.request('POST', '/signals/import', {
        prospects: args.prospects,
      });

    case 'magnetlab_list_signal_variables':
      return client.request('GET', '/signals/variables');

    case 'magnetlab_create_signal_variable':
      return client.request('POST', '/signals/variables', {
        name: args.name,
        field_type: args.field_type,
        scoring_rule: args.scoring_rule,
        display_order: args.display_order,
      });

    case 'magnetlab_signal_recommendations':
      return client.request('POST', '/signals/leads', {
        limit: args.limit ?? 10,
        min_score: args.min_score,
        status: 'qualified',
      });

    default:
      throw new Error(`Unknown signal tool: ${name}`);
  }
}
