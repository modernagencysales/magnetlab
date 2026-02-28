import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { buildCopilotSystemPrompt } from '@/lib/ai/copilot/system-prompt';
import { executeAction, actionRequiresConfirmation, getToolDefinitions } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions';
import { logError } from '@/lib/utils/logger';

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
    if (!conversationId) {
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
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 });
      }
      conversationId = conv.id;
    }

    // Save user message
    await supabase.from('copilot_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: body.message,
    });

    // Load conversation history (last 50 messages)
    const { data: history } = await supabase
      .from('copilot_messages')
      .select('role, content, tool_name, tool_args, tool_result')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    // Build messages for Claude
    const claudeMessages = (history || []).map(msg => {
      if (msg.role === 'user') {
        return { role: 'user' as const, content: msg.content || '' };
      }
      if (msg.role === 'assistant') {
        return { role: 'assistant' as const, content: msg.content || '' };
      }
      if (msg.role === 'tool_call') {
        return {
          role: 'assistant' as const,
          content: [{ type: 'tool_use' as const, id: `tool_${Date.now()}`, name: msg.tool_name || '', input: msg.tool_args || {} }],
        };
      }
      if (msg.role === 'tool_result') {
        return {
          role: 'user' as const,
          content: [{ type: 'tool_result' as const, tool_use_id: `tool_${Date.now()}`, content: JSON.stringify(msg.tool_result) }],
        };
      }
      return { role: 'user' as const, content: msg.content || '' };
    });

    // Build system prompt
    const systemPrompt = await buildCopilotSystemPrompt(userId, body.pageContext);

    // Get tool definitions
    const tools = getToolDefinitions();

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

            const response = await client.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              tools: tools as Parameters<typeof client.messages.create>[0]['tools'],
              messages: currentMessages as Parameters<typeof client.messages.create>[0]['messages'],
            });

            let hasToolUse = false;
            let assistantText = '';

            for (const block of response.content) {
              if (block.type === 'text') {
                assistantText += block.text;
                send('text_delta', { text: block.text });
              } else if (block.type === 'tool_use') {
                hasToolUse = true;

                // Check if confirmation required
                if (actionRequiresConfirmation(block.name)) {
                  send('confirmation_required', {
                    tool: block.name,
                    args: block.input,
                    toolUseId: block.id,
                  });
                  // For now, auto-approve (Phase 2b will add confirmation UI)
                }

                send('tool_call', { name: block.name, args: block.input, id: block.id });

                // Save tool call message
                await supabase.from('copilot_messages').insert({
                  conversation_id: conversationId,
                  role: 'tool_call',
                  tool_name: block.name,
                  tool_args: block.input as Record<string, unknown>,
                });

                // Execute the action
                const result = await executeAction(actionCtx, block.name, block.input as Record<string, unknown>);

                send('tool_result', {
                  name: block.name,
                  result,
                  id: block.id,
                });

                // Save tool result message
                await supabase.from('copilot_messages').insert({
                  conversation_id: conversationId,
                  role: 'tool_result',
                  tool_name: block.name,
                  tool_result: result,
                });

                // Add to messages for next iteration
                currentMessages = [
                  ...currentMessages,
                  {
                    role: 'assistant' as const,
                    content: response.content.map(b => {
                      if (b.type === 'text') return { type: 'text' as const, text: b.text };
                      if (b.type === 'tool_use') return { type: 'tool_use' as const, id: b.id, name: b.name, input: b.input };
                      return b;
                    }),
                  },
                  {
                    role: 'user' as const,
                    content: [{ type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result) }],
                  },
                ];
              }
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
