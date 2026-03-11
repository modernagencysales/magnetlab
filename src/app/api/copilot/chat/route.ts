import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { buildCopilotSystemPrompt } from '@/lib/ai/copilot/system-prompt';
import type { ActionContext } from '@/lib/actions';
import { logError } from '@/lib/utils/logger';
import { detectCorrectionSignal, extractMemories } from '@/lib/ai/copilot/memory-extractor';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { checkUsageAllocation, trackUsageEvent } from '@/lib/services/accelerator-usage';
import { buildClaudeMessages } from '@/lib/ai/copilot/chat-history';
import type { DbMessage } from '@/lib/ai/copilot/chat-history';
import { runAgentLoop } from '@/lib/ai/copilot/chat-agent-loop';
import {
  getOrCreateConversation,
  saveUserMessage,
  touchConversation,
} from '@/lib/ai/copilot/chat-conversation';
import { buildChatTools } from '@/lib/ai/copilot/chat-tools';

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

    // ─── Enrollment Access + Usage Check ─────────────────
    // Accelerator features require a paid enrollment.
    // Non-accelerator copilot usage (page-context help) is not gated.
    // Single query: getEnrollmentByUserId returns the full enrollment or null.
    const isAcceleratorRequest =
      body.message?.toLowerCase().includes('accelerator') ||
      body.pageContext?.page?.includes('accelerator');

    let cachedEnrollmentCheck: boolean | null = null;
    let enrollmentId: string | undefined;

    if (isAcceleratorRequest) {
      const enrollment = await getEnrollmentByUserId(userId);
      cachedEnrollmentCheck = !!enrollment;
      if (!enrollment) {
        return new Response(
          JSON.stringify({
            error: 'GTM Accelerator requires enrollment.',
            code: 'ENROLLMENT_REQUIRED',
            enrollUrl: '/api/accelerator/enroll',
          }),
          { status: 403 }
        );
      }
      enrollmentId = enrollment.id;
      const { withinLimits, usage, limits } = await checkUsageAllocation(enrollment.id);
      if (!withinLimits) {
        return new Response(
          JSON.stringify({
            error: `Monthly usage limit reached (${usage.sessions}/${limits.sessions} sessions, ${usage.deliverables}/${limits.deliverables} deliverables). Resets next month.`,
            code: 'USAGE_LIMIT_EXCEEDED',
          }),
          { status: 429 }
        );
      }
    }

    const supabase = createSupabaseAdminClient();

    // Get or create conversation
    const convResult = await getOrCreateConversation(
      userId,
      body.conversationId,
      body.message,
      body.pageContext
    );
    if ('error' in convResult) {
      return new Response(JSON.stringify({ error: convResult.error }), {
        status: convResult.status,
      });
    }
    const conversationId = convResult.conversationId;

    // Save user message
    await saveUserMessage(conversationId, body.message);

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

    // Get tool definitions (base actions + sub-agent dispatch)
    const allTools = buildChatTools();

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
            conversationId,
            userId,
            actionCtx,
            cachedEnrollmentCheck,
            send,
          });

          // Update conversation timestamp
          await touchConversation(conversationId);

          // Track usage for accelerator sessions (non-fatal)
          if (enrollmentId) {
            trackUsageEvent(enrollmentId, 'api_call', { conversationId, iterations }).catch((err) =>
              logError('copilot/chat', err, { step: 'usage_tracking' })
            );
          }

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
