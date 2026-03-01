import { NextRequest } from 'next/server';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';
import { logApiError } from '@/lib/api/errors';
import { getChatContext, saveAssistantMessage, getChatHistory } from '@/server/services/public.service';

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
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (typeof sessionToken !== 'string' || sessionToken.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadMagnetId)) {
      return new Response(JSON.stringify({ error: 'Invalid ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const context = await getChatContext(leadMagnetId, sessionToken, message);
    if (!context.success) {
      if (context.error === 'not_found') {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (context.error === 'rate_limit_hourly' || context.error === 'rate_limit_daily') {
        return new Response(
          JSON.stringify({
            error: context.error === 'rate_limit_hourly' ? 'Rate limit reached. Try again later.' : 'This tool has reached its daily message limit.',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { config, chatId: currentChatId, messages } = context;
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = getAnthropicClient('public-chat').messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: config.maxTokens || 2048,
            system: config.systemPrompt,
            messages,
          });

          for await (const event of anthropicStream) {
            if (request.signal.aborted) break;
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullResponse += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: event.delta.text })}\n\n`)
              );
            }
          }

          if (fullResponse && !request.signal.aborted) {
            await saveAssistantMessage(currentChatId, fullResponse);
          }

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

  const { messages, chatId } = await getChatHistory(leadMagnetId, sessionToken);
  return Response.json({ messages, chatId });
}
