/** Chat Tools Assembly.
 *  Builds the complete tool list for copilot chat: base actions + sub-agent dispatch.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getToolDefinitions } from '@/lib/actions';

// ─── Types ───────────────────────────────────────────────

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// ─── Constants ───────────────────────────────────────────

const SUB_AGENT_DISPATCH_TOOL: ToolDefinition = {
  name: 'dispatch_sub_agent',
  description:
    'Dispatch a specialist sub-agent for deep module work. The sub-agent runs independently and returns a handoff summary.',
  input_schema: {
    type: 'object',
    properties: {
      agent_type: {
        type: 'string',
        enum: [
          'icp',
          'lead_magnet',
          'content',
          'troubleshooter',
          'tam',
          'outreach',
          'linkedin_ads',
          'operating_system',
        ],
        description: 'Which specialist to dispatch',
      },
      context: {
        type: 'string',
        description: 'Summary of what the user needs help with',
      },
      user_message: {
        type: 'string',
        description: 'The user message to forward to the sub-agent',
      },
    },
    required: ['agent_type', 'context', 'user_message'],
  },
};

// ─── Builder ─────────────────────────────────────────────

export function buildChatTools(): Record<string, unknown>[] {
  const baseTools = getToolDefinitions();
  return [...baseTools, SUB_AGENT_DISPATCH_TOOL] as Record<string, unknown>[];
}
