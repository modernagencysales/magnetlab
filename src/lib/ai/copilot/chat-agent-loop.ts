/** Chat Agent Loop.
 *  Runs the multi-turn agentic loop: stream Claude responses, execute tool calls,
 *  handle sub-agent dispatch, persist messages, and iterate until stop_reason=end_turn.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { executeAction, actionRequiresConfirmation } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions';
import { dispatchSubAgent } from '@/lib/ai/copilot/sub-agent-dispatch';
import type { SubAgentType } from '@/lib/types/accelerator';
import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Constants ───────────────────────────────────────────

const MAX_ITERATIONS = 15;

// ─── Types ───────────────────────────────────────────────

export interface AgentLoopOptions {
  systemPrompt: string;
  tools: Record<string, unknown>[];
  initialMessages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }>;
  conversationId: string;
  userId: string;
  actionCtx: ActionContext;
  cachedEnrollmentCheck: boolean | null;
  send: (event: string, data: unknown) => void;
  maxIterations?: number;
}

export interface AgentLoopResult {
  iterations: number;
}

// ─── Loop ────────────────────────────────────────────────

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    systemPrompt,
    tools,
    initialMessages,
    conversationId,
    userId,
    actionCtx,
    cachedEnrollmentCheck,
    send,
    maxIterations = MAX_ITERATIONS,
  } = options;

  const supabase = createSupabaseAdminClient();
  const client = createAnthropicClient('copilot', { timeout: 240_000 });

  let currentMessages = [...initialMessages];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // I1 FIX: Use streaming API for real-time text deltas
    const claudeStream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools as unknown as Parameters<typeof client.messages.create>[0]['tools'],
      messages: currentMessages as unknown as Parameters<
        typeof client.messages.create
      >[0]['messages'],
    });

    let assistantText = '';

    // Stream text deltas in real-time
    claudeStream.on('text', (text) => {
      assistantText += text;
      send('text_delta', { text });
    });

    // Wait for the full response (tool_use blocks only available after stream completes)
    const response = await claudeStream.finalMessage();

    // I4 FIX: Collect ALL tool_use blocks first, then execute them,
    // then send a single user message with all tool_results
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    const hasToolUse = toolUseBlocks.length > 0;

    if (hasToolUse) {
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }> = [];

      for (const block of toolUseBlocks) {
        const needsConfirmation = actionRequiresConfirmation(block.name);

        // Send confirmation_required event if needed
        if (needsConfirmation) {
          send('confirmation_required', {
            tool: block.name,
            args: block.input,
            toolUseId: block.id,
          });
        }

        send('tool_call', { name: block.name, args: block.input, id: block.id });

        // Save tool call message
        await supabase.from('copilot_messages').insert({
          conversation_id: conversationId,
          role: 'tool_call',
          tool_name: block.name,
          tool_args: block.input as Record<string, unknown>,
        });

        if (needsConfirmation) {
          // Do NOT execute — wait for user confirmation
          const pendingResult = {
            success: false,
            error: 'Action requires user confirmation. Waiting for approval.',
            awaiting_confirmation: true,
          };

          send('tool_result', { name: block.name, result: pendingResult, id: block.id });

          await supabase.from('copilot_messages').insert({
            conversation_id: conversationId,
            role: 'tool_result',
            tool_name: block.name,
            tool_result: pendingResult,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(pendingResult),
          });
        } else {
          // Execute the action (with special sub-agent dispatch handling)
          let result;
          if (block.name === 'dispatch_sub_agent') {
            // Verify enrollment before dispatching accelerator sub-agents
            // Use cached result from soft gate when available
            const hasEnrollment = cachedEnrollmentCheck ?? (await hasAcceleratorAccess(userId));
            if (!hasEnrollment) {
              result = {
                success: false,
                error: 'Accelerator enrollment required. Purchase at /api/accelerator/enroll',
                displayHint: 'text' as const,
              };
            } else {
              const input = block.input as {
                agent_type: SubAgentType;
                context: string;
                user_message: string;
              };
              const { buildSubAgentConfig } = await import('@/lib/ai/copilot/sub-agents/config');
              const subConfig = await buildSubAgentConfig(
                input.agent_type,
                input.context,
                input.user_message,
                userId
              );
              const handoff = await dispatchSubAgent(subConfig, actionCtx, send);
              result = { success: true, data: handoff, displayHint: 'text' as const };
            }
          } else {
            result = await executeAction(
              actionCtx,
              block.name,
              block.input as Record<string, unknown>
            );
          }

          send('tool_result', { name: block.name, result, id: block.id });

          // Save tool result message
          await supabase.from('copilot_messages').insert({
            conversation_id: conversationId,
            role: 'tool_result',
            tool_name: block.name,
            tool_result: result,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Build next iteration messages: one assistant message with all content blocks,
      // one user message with ALL tool results
      currentMessages = [
        ...currentMessages,
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

    // Save assistant text if any
    if (assistantText) {
      await supabase.from('copilot_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantText,
        tokens_used: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      });
    }

    // If no tool use, we're done. When tools were used, always continue
    // so Claude can incorporate tool results — even if stop_reason is end_turn.
    if (!hasToolUse) {
      break;
    }
  }

  return { iterations: iteration };
}
