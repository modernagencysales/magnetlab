/** Sub-Agent Config Builder.
 *  Assembles SubAgentConfig for each specialist type.
 *  Stub -- full implementation in Task 9. */

import type { SubAgentConfig } from '../sub-agent-dispatch';
import type { SubAgentType } from '@/lib/types/accelerator';
import { getToolDefinitions } from '@/lib/actions';

export async function buildSubAgentConfig(
  agentType: SubAgentType,
  context: string,
  userMessage: string,
  _userId: string
): Promise<SubAgentConfig> {
  // Stub: returns basic config. Full implementation adds SOPs and agent-specific prompts.
  return {
    type: agentType,
    systemPrompt: `You are the ${agentType} specialist in the GTM Accelerator. Help the user with: ${context}`,
    tools: getToolDefinitions(),
    contextSummary: context,
    userMessage,
  };
}
