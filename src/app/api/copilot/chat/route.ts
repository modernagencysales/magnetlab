import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { buildCopilotSystemPrompt } from '@/lib/ai/copilot/system-prompt';
import { executeAction, actionRequiresConfirmation, getToolDefinitions } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions';
import { logError } from '@/lib/utils/logger';
import { detectCorrectionSignal, extractMemories } from '@/lib/ai/copilot/memory-extractor';
import { dispatchSubAgent } from '@/lib/ai/copilot/sub-agent-dispatch';
import type { SubAgentType } from '@/lib/types/accelerator';

const MAX_ITERATIONS = 15;

interface ChatRequest {
  message: string;
  conversationId?: string;
  pageContext?: {
    page: string;
    entityType?: string;
    entityId?: string;
    entityTitle?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body: ChatRequest = await req.json();
    if (!body.message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }

    const userId = session.user.id;
    const supabase = createSupabaseAdminClient();

    // Get or create conversation
    let conversationId = body.conversationId;
    if (conversationId) {
      // C1 FIX: Verify conversation belongs to authenticated user
      const { data: existing } = await supabase
        .from('copilot_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
      }
    } else {
      const { data: conv, error: convError } = await supabase
        .from('copilot_conversations')
        .insert({
          user_id: userId,
          entity_type: body.pageContext?.entityType || null,
          entity_id: body.pageContext?.entityId || null,
          title: body.message.slice(0, 100),
        })
        .select('id')
        .single();

      if (convError || !conv) {
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500,
        });
      }
      conversationId = conv.id;
    }

    // Save user message
    await supabase.from('copilot_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: body.message,
    });

    // Fire-and-forget: extract memories if correction signal detected
    if (detectCorrectionSignal(body.message)) {
      const { data: recentMsgs } = await supabase
        .from('copilot_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(6);

      const context = (recentMsgs || [])
        .reverse()
        .filter(
          (m: { role: string; content: string | null }) =>
            m.role === 'user' || m.role === 'assistant'
        )
        .map((m: { role: string; content: string | null }) => ({
          role: m.role,
          content: m.content || '',
        }));

      extractMemories(userId, context)
        .then(async (memories) => {
          if (memories.length > 0) {
            await supabase.from('copilot_memories').insert(
              memories.map((m) => ({
                user_id: userId,
                rule: m.rule,
                category: m.category,
                confidence: m.confidence,
                source: 'conversation' as const,
                conversation_id: conversationId,
              }))
            );
          }
        })
        .catch(() => {});
    }

    // Load conversation history (last 50 messages)
    // C2 FIX: Select id for deterministic tool_use_id generation
    const { data: history } = await supabase
      .from('copilot_messages')
      .select('id, role, content, tool_name, tool_args, tool_result')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    // C2 FIX: Build messages with deterministic tool IDs from message row IDs
    // Group consecutive tool_call + tool_result pairs for correct multi-tool handling
    const claudeMessages: Array<{
      role: 'user' | 'assistant';
      content: string | Array<Record<string, unknown>>;
    }> = [];
    const historyArr = history || [];

    for (let i = 0; i < historyArr.length; i++) {
      const msg = historyArr[i];
      if (msg.role === 'user') {
        claudeMessages.push({ role: 'user', content: msg.content || '' });
      } else if (msg.role === 'assistant') {
        claudeMessages.push({ role: 'assistant', content: msg.content || '' });
      } else if (msg.role === 'tool_call') {
        // Collect all consecutive tool_call + tool_result pairs into one assistant + one user message
        const toolUseBlocks: Array<Record<string, unknown>> = [];
        const toolResultBlocks: Array<Record<string, unknown>> = [];

        while (i < historyArr.length && historyArr[i].role === 'tool_call') {
          const tc = historyArr[i];
          const toolId = `tool_${tc.id}`;
          toolUseBlocks.push({
            type: 'tool_use',
            id: toolId,
            name: tc.tool_name || '',
            input: tc.tool_args || {},
          });

          // Look for matching tool_result immediately after
          if (i + 1 < historyArr.length && historyArr[i + 1].role === 'tool_result') {
            const tr = historyArr[i + 1];
            toolResultBlocks.push({
              type: 'tool_result',
              tool_use_id: toolId,
              content: JSON.stringify(tr.tool_result),
            });
            i += 2;
          } else {
            i++;
          }
        }
        i--; // Adjust for outer loop increment

        if (toolUseBlocks.length > 0) {
          claudeMessages.push({ role: 'assistant', content: toolUseBlocks });
        }
        if (toolResultBlocks.length > 0) {
          claudeMessages.push({ role: 'user', content: toolResultBlocks });
        }
      }
      // Skip orphan tool_result (handled above)
    }

    // Build system prompt
    const systemPrompt = await buildCopilotSystemPrompt(userId, body.pageContext);

    // Get tool definitions
    const tools = getToolDefinitions();

    // Add sub-agent dispatch tool for Accelerator
    const allTools = [
      ...tools,
      {
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
      },
    ];

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const client = createAnthropicClient('copilot', { timeout: 240_000 });
          const actionCtx: ActionContext = { userId };

          // Get team ID if user has one
          const { data: teamMember } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', userId)
            .limit(1)
            .single();
          if (teamMember?.team_id) {
            actionCtx.teamId = teamMember.team_id;
          }

          send('conversation_id', { conversationId });

          let currentMessages = [...claudeMessages];
          let iteration = 0;

          while (iteration < MAX_ITERATIONS) {
            iteration++;

            // I1 FIX: Use streaming API for real-time text deltas
            const stream = client.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              tools: allTools as Parameters<typeof client.messages.create>[0]['tools'],
              messages: currentMessages as Parameters<typeof client.messages.create>[0]['messages'],
            });

            let assistantText = '';

            // Stream text deltas in real-time
            stream.on('text', (text) => {
              assistantText += text;
              send('text_delta', { text });
            });

            // Wait for the full response (tool_use blocks only available after stream completes)
            const response = await stream.finalMessage();

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
                    const input = block.input as {
                      agent_type: SubAgentType;
                      context: string;
                      user_message: string;
                    };
                    const { buildSubAgentConfig } =
                      await import('@/lib/ai/copilot/sub-agents/config');
                    const subConfig = await buildSubAgentConfig(
                      input.agent_type,
                      input.context,
                      input.user_message,
                      userId
                    );
                    const handoff = await dispatchSubAgent(subConfig, actionCtx, send);
                    result = { success: true, data: handoff, displayHint: 'text' as const };
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
                tokens_used:
                  (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
              });
            }

            // If no tool use, we're done
            if (!hasToolUse || response.stop_reason === 'end_turn') {
              break;
            }
          }

          // Update conversation timestamp
          await supabase
            .from('copilot_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          send('done', { conversationId, iterations: iteration });
        } catch (error) {
          logError('copilot/chat', error, { userId, conversationId });
          send('error', { message: error instanceof Error ? error.message : 'Stream error' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    logError('copilot/chat', error, { step: 'request_parse' });
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
