/** Sub-Agent Dispatch.
 *  Creates separate Claude API calls for specialist sub-agents.
 *  Streams sub-agent responses through the parent SSE connection.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { executeAction } from '@/lib/actions';
import { logError } from '@/lib/utils/logger';
import type { ActionContext } from '@/lib/actions';
import type { SubAgentType, SubAgentHandoff } from '@/lib/types/accelerator';

const LOG_CTX = 'sub-agent-dispatch';
const SUB_AGENT_MAX_ITERATIONS = 10;

// ─── Types ───────────────────────────────────────────────

export interface SubAgentConfig {
  type: SubAgentType;
  systemPrompt: string;
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  contextSummary: string;
  userMessage: string;
}

export type SSESender = (event: string, data: unknown) => void;

// ─── Dispatch ────────────────────────────────────────────

export async function dispatchSubAgent(
  config: SubAgentConfig,
  actionCtx: ActionContext,
  sendSSE: SSESender
): Promise<SubAgentHandoff> {
  const defaultHandoff: SubAgentHandoff = {
    deliverables_created: [],
    progress_updates: [],
    validation_results: [],
    needs_escalation: false,
    summary: '',
  };

  try {
    sendSSE('sub_agent_start', { type: config.type, message: getSubAgentLabel(config.type) });

    const client = createAnthropicClient('accelerator-sub-agent', { timeout: 300_000 });

    let messages: Array<{
      role: 'user' | 'assistant';
      content: string | Array<Record<string, unknown>>;
    }> = [{ role: 'user', content: `${config.contextSummary}\n\n${config.userMessage}` }];

    let iteration = 0;
    let fullText = '';

    while (iteration < SUB_AGENT_MAX_ITERATIONS) {
      iteration++;

      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: config.systemPrompt,
        tools: config.tools as Parameters<typeof client.messages.create>[0]['tools'],
        messages: messages as Parameters<typeof client.messages.create>[0]['messages'],
      });

      // Forward text deltas through parent SSE
      stream.on('text', (text) => {
        fullText += text;
        sendSSE('text_delta', { text });
      });

      const response = await stream.finalMessage();

      const toolUseBlocks = response.content.filter(
        (b): b is Extract<(typeof response.content)[number], { type: 'tool_use' }> =>
          b.type === 'tool_use'
      );

      if (toolUseBlocks.length > 0) {
        const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> =
          [];

        for (const block of toolUseBlocks) {
          sendSSE('tool_call', {
            name: block.name,
            args: block.input,
            id: block.id,
            subAgent: config.type,
          });

          // Execute through the action system — graceful on failure
          let result;
          try {
            result = await executeAction(
              actionCtx,
              block.name,
              block.input as Record<string, unknown>
            );
          } catch (toolErr) {
            // Tool threw unexpectedly — return error result so sub-agent can adapt
            logError(LOG_CTX, toolErr, {
              type: config.type,
              tool: block.name,
              context: 'tool_execution_failed',
            });
            result = {
              success: false,
              error: `Tool "${block.name}" failed: ${toolErr instanceof Error ? toolErr.message : 'Unknown error'}. You can continue with other tools or report the issue.`,
            };
          }

          sendSSE('tool_result', {
            name: block.name,
            result,
            id: block.id,
            subAgent: config.type,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        // Build next messages for the sub-agent loop
        messages = [
          ...messages,
          {
            role: 'assistant' as const,
            content: response.content.map((b) => {
              if (b.type === 'text') return { type: 'text' as const, text: b.text };
              if (b.type === 'tool_use')
                return { type: 'tool_use' as const, id: b.id, name: b.name, input: b.input };
              return b;
            }) as Record<string, unknown>[],
          },
          {
            role: 'user' as const,
            content: toolResults as Record<string, unknown>[],
          },
        ];
      }

      // If no tool use, sub-agent is done. When tools were used, always
      // continue so the model can incorporate tool results.
      if (toolUseBlocks.length === 0) {
        break;
      }
    }

    sendSSE('sub_agent_end', { type: config.type });

    // Parse handoff from the sub-agent's final text
    const handoff = parseHandoff(fullText, defaultHandoff);
    return handoff;
  } catch (err) {
    logError(LOG_CTX, err, { type: config.type });
    sendSSE('sub_agent_end', { type: config.type, error: true });

    return {
      ...defaultHandoff,
      needs_escalation: true,
      summary: `Sub-agent ${config.type} encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────

function getSubAgentLabel(type: SubAgentType): string {
  const labels: Record<SubAgentType, string> = {
    icp: 'Bringing in the ICP & Positioning specialist...',
    lead_magnet: 'Bringing in the Lead Magnet specialist...',
    content: 'Bringing in the Content Engine specialist...',
    tam: 'Bringing in the TAM Builder specialist...',
    outreach: 'Bringing in the Outreach Setup specialist...',
    troubleshooter: 'Running diagnostics...',
    linkedin_ads: 'Bringing in the LinkedIn Ads specialist...',
    operating_system: 'Bringing in the Operating System specialist...',
  };
  return labels[type];
}

/** Exported for testing. */
export function parseHandoff(text: string, defaultHandoff: SubAgentHandoff): SubAgentHandoff {
  // Try to extract structured handoff from the text
  // Sub-agents are instructed to end with a JSON handoff block
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        deliverables_created: parsed.deliverables_created || [],
        progress_updates: parsed.progress_updates || [],
        validation_results: parsed.validation_results || [],
        needs_escalation: parsed.needs_escalation || false,
        summary: parsed.summary || text.slice(0, 200),
      };
    } catch (error) {
      logError(LOG_CTX, error, { context: 'parseHandoff', textLength: text.length });
    }
  }

  // Default: use the full text as summary
  return {
    ...defaultHandoff,
    summary: text.slice(0, 500),
  };
}
