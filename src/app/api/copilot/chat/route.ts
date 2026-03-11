import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { buildCopilotSystemPrompt } from '@/lib/ai/copilot/system-prompt';
import { getToolDefinitions } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions';
import { logError } from '@/lib/utils/logger';
import { detectCorrectionSignal, extractMemories } from '@/lib/ai/copilot/memory-extractor';
import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
import { buildClaudeMessages } from '@/lib/ai/copilot/chat-history';
import type { DbMessage } from '@/lib/ai/copilot/chat-history';
import { runAgentLoop } from '@/lib/ai/copilot/chat-agent-loop';

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

    // ─── Enrollment Access Check ────────────────────────
    // Accelerator features require a paid enrollment.
    // Non-accelerator copilot usage (page-context help) is not gated.
    // Result cached to avoid duplicate DB queries in sub-agent dispatch.
    const isAcceleratorRequest =
      body.message?.toLowerCase().includes('accelerator') ||
      body.pageContext?.page?.includes('accelerator');

    let cachedEnrollmentCheck: boolean | null = null;

    if (isAcceleratorRequest) {
      cachedEnrollmentCheck = await hasAcceleratorAccess(userId);
      if (!cachedEnrollmentCheck) {
        return new Response(
          JSON.stringify({
            error: 'GTM Accelerator requires enrollment.',
            code: 'ENROLLMENT_REQUIRED',
            enrollUrl: '/api/accelerator/enroll',
          }),
          { status: 403 }
        );
      }
    }

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
        .catch((err) => logError('copilot/memory-extraction', err, { userId, conversationId }));
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
    const claudeMessages = buildClaudeMessages((history || []) as DbMessage[]);

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

          const { iterations } = await runAgentLoop({
            systemPrompt,
            tools: allTools,
            initialMessages: claudeMessages,
            conversationId: conversationId!,
            userId,
            actionCtx,
            cachedEnrollmentCheck,
            send,
          });

          // Update conversation timestamp
          await supabase
            .from('copilot_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          send('done', { conversationId, iterations });
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
