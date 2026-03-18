/** Account safety handler. Dispatches 2 safety settings tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleAccountSafetyTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_account_safety_settings':
      return client.getAccountSafetySettings(args.unipile_account_id as string);

    case 'magnetlab_update_account_safety_settings': {
      const { unipile_account_id, ...settings } = args;
      // Transform snake_case MCP args to camelCase API fields
      const camelCaseSettings: Record<string, unknown> = {};
      if (settings.max_dms_per_day !== undefined)
        camelCaseSettings.maxDmsPerDay = settings.max_dms_per_day;
      if (settings.max_connection_requests_per_day !== undefined)
        camelCaseSettings.maxConnectionRequestsPerDay = settings.max_connection_requests_per_day;
      if (settings.max_connection_accepts_per_day !== undefined)
        camelCaseSettings.maxConnectionAcceptsPerDay = settings.max_connection_accepts_per_day;
      if (settings.max_comments_per_day !== undefined)
        camelCaseSettings.maxCommentsPerDay = settings.max_comments_per_day;
      if (settings.max_likes_per_day !== undefined)
        camelCaseSettings.maxLikesPerDay = settings.max_likes_per_day;
      if (settings.min_action_delay_ms !== undefined)
        camelCaseSettings.minActionDelayMs = settings.min_action_delay_ms;
      if (settings.max_action_delay_ms !== undefined)
        camelCaseSettings.maxActionDelayMs = settings.max_action_delay_ms;
      if (settings.operating_hours_start !== undefined)
        camelCaseSettings.operatingHoursStart = settings.operating_hours_start;
      if (settings.operating_hours_end !== undefined)
        camelCaseSettings.operatingHoursEnd = settings.operating_hours_end;
      if (settings.timezone !== undefined) camelCaseSettings.timezone = settings.timezone;

      return client.updateAccountSafetySettings(unipile_account_id as string, camelCaseSettings);
    }

    default:
      throw new Error(`Unknown account safety tool: ${name}`);
  }
}
