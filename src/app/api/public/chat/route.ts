import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';
import { logApiError } from '@/lib/api/errors';
import type { GPTConfig } from '@/lib/types/lead-magnet';

export async function POST(request: NextRequest) {
  try {
    const { leadMagnetId, sessionToken, message, chatId } = await request.json();

    if (!leadMagnetId || !sessionToken || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (typeof message !== 'string' || message.length > 10000) {
      return new Response(JSON.stringify({ error: 'Message too long' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (typeof sessionToken !== 'string' || sessionToken.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadMagnetId)) {
      return new Response(JSON.stringify({ error: 'Invalid ID' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createSupabaseAdminClient();

    // Load lead magnet
    const { data: lm } = await supabase
      .from('lead_magnets')
      .select('interactive_config')
      .eq('id', leadMagnetId)
      .single();

    if (!lm?.interactive_config || (lm.interactive_config as Record<string, unknown>).type !== 'gpt') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config = lm.interactive_config as unknown as GPTConfig;

    // Find or create chat
    let currentChatId = chatId;
    if (!currentChatId) {
      const { data: existingChat } = await supabase
        .from('interactive_chats')
        .select('id')
        .eq('lead_magnet_id', leadMagnetId)
        .eq('session_token', sessionToken)
        .single();

      if (existingChat) {
        currentChatId = existingChat.id;
      } else {
        const { data: newChat } = await supabase
          .from('interactive_chats')
          .insert({
            lead_magnet_id: leadMagnetId,
            session_token: sessionToken,
            title: message.substring(0, 100),
          })
          .select('id')
          .single();

        if (!newChat) throw new Error('Failed to create chat');
        currentChatId = newChat.id;
      }
    }

    // Rate limit: 50 messages per hour per chat
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: hourlyCount } = await supabase
      .from('interactive_chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', currentChatId)
      .eq('role', 'user')
      .gte('created_at', oneHourAgo);

    if ((hourlyCount ?? 0) >= 50) {
      return new Response(JSON.stringify({ error: 'Rate limit reached. Try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Per-lead-magnet daily limit (5000 messages/day across all sessions)
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count: dailyCount } = await supabase
      .from('interactive_chat_messages')
      .select('id, interactive_chats!inner(lead_magnet_id)', { count: 'exact', head: true })
      .eq('interactive_chats.lead_magnet_id', leadMagnetId)
      .eq('role', 'user')
      .gte('created_at', oneDayAgo);

    if ((dailyCount ?? 0) >= 5000) {
      return new Response(JSON.stringify({ error: 'This tool has reached its daily message limit.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Save user message
    await supabase.from('interactive_chat_messages').insert({
      chat_id: currentChatId,
      role: 'user',
      content: message,
    });

    // Load conversation history (last 20 messages for context)
    const { data: history } = await supabase
      .from('interactive_chat_messages')
      .select('role, content')
      .eq('chat_id', currentChatId)
      .order('created_at', { ascending: true })
      .limit(20);

    const messages = (history || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Stream response
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = getAnthropicClient().messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: config.maxTokens || 2048,
            system: config.systemPrompt,
            messages,
          });

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullResponse += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: event.delta.text })}\n\n`)
              );
            }
          }

          // Save assistant response
          await supabase.from('interactive_chat_messages').insert({
            chat_id: currentChatId,
            role: 'assistant',
            content: fullResponse,
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', chatId: currentChatId })}\n\n`)
          );
          controller.close();
        } catch (error) {
          logApiError('public/chat', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`)
          );
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
    logApiError('public/chat', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const leadMagnetId = searchParams.get('leadMagnetId');
  const sessionToken = searchParams.get('sessionToken');

  if (!leadMagnetId || !sessionToken) {
    return Response.json({ error: 'Missing params' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: chat } = await supabase
    .from('interactive_chats')
    .select('id')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('session_token', sessionToken)
    .single();

  if (!chat) {
    return Response.json({ messages: [], chatId: null });
  }

  const { data: messages } = await supabase
    .from('interactive_chat_messages')
    .select('role, content, created_at')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true });

  return Response.json({ messages: messages || [], chatId: chat.id });
}
