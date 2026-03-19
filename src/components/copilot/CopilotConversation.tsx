/** CopilotConversation. Full-page conversation view with SSE streaming. Constraint: Self-contained — does not depend on CopilotProvider or CopilotSidebar. */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import { MessageList } from './MessageList';
import { PromptInput } from './PromptInput';
import type { CopilotMessage, PendingConfirmation } from './copilot-types';
import { logError } from '@/lib/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CopilotConversationProps {
  conversationId: string;
  initialMessage?: string;
  sourceContext?: {
    page: string;
    entityType?: string;
    entityId?: string;
    entityTitle?: string;
  };
}

// ─── SSE Parser ─────────────────────────────────────────────────────────────────

type SSEEventHandler = (eventType: string, data: Record<string, unknown>) => void;

function parseSSELines(lines: string[], handler: SSEEventHandler): void {
  let currentEvent = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ') && currentEvent) {
      try {
        const data = JSON.parse(line.slice(6));
        handler(currentEvent, data);
      } catch {
        /* ignore JSON parse errors */
      }
      currentEvent = '';
    } else if (line === '') {
      currentEvent = '';
    }
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function CopilotConversation({
  conversationId: initialConversationId,
  initialMessage,
  sourceContext,
}: CopilotConversationProps) {
  const router = useRouter();

  // ─── State ────────────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversationTitle, setConversationTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  const hasInitializedRef = useRef(false);
  const conversationIdRef = useRef(conversationId);

  // Keep ref in sync so confirmAction can use latest value
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // ─── Load Existing Conversation ───────────────────────────────────────────────

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/copilot/conversations/${id}`);
        if (!res.ok) {
          console.warn(`Conversation ${id} not found or inaccessible, redirecting to /`);
          router.replace('/');
          return;
        }

        const data = await res.json();
        setConversationTitle(data.conversation?.title || '');
        setMessages(
          (data.messages || []).map((m: Record<string, unknown>) => ({
            id: m.id as string,
            role: m.role as CopilotMessage['role'],
            content: (m.content as string) || '',
            toolName: m.tool_name as string | undefined,
            toolArgs: m.tool_args as Record<string, unknown> | undefined,
            toolResult: m.tool_result as Record<string, unknown> | undefined,
            feedback: m.feedback as CopilotMessage['feedback'],
            displayHint: (m.tool_result as Record<string, unknown> | undefined)?.displayHint as
              | string
              | undefined,
            createdAt: m.created_at as string,
          }))
        );
      } catch (err) {
        logError('CopilotConversation/loadConversation', err, { id });
        console.warn('Failed to load conversation, redirecting to /');
        router.replace('/');
      }
    },
    [router]
  );

  // ─── Send Message (SSE Streaming) ─────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);

      // Add user message optimistically
      const userMsg: CopilotMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Prepare streaming assistant message placeholder
      const assistantMsgId = `temp-assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: '',
          createdAt: new Date().toISOString(),
        },
      ]);

      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        // Build request body
        const body: Record<string, unknown> = {
          message: text,
          conversationId: conversationIdRef.current,
        };

        // Briefing flag: homepage-initiated new conversation (no sourceContext)
        if (conversationIdRef.current === 'new' && !sourceContext) {
          body.briefing = true;
        }

        // Source context: Cmd+K initiated conversation
        if (sourceContext) {
          body.sourceContext = sourceContext;
          body.pageContext = sourceContext;
        }

        const res = await fetch('/api/copilot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          let errText = `Request failed (${res.status})`;
          try {
            const errBody = await res.json();
            errText = errBody.error || errText;
          } catch {
            /* not JSON */
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `Error: ${errText}` } : m))
          );
          setError(errText);
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handleSSEEvent: SSEEventHandler = (eventType, data) => {
          switch (eventType) {
            case 'conversation_id': {
              const newId = data.conversationId as string;
              setConversationId(newId);
              conversationIdRef.current = newId;
              // Update URL without full navigation
              router.replace(`/copilot/${newId}`, { scroll: false });
              // Use first message as title until API provides one
              setConversationTitle(text.slice(0, 100));
              break;
            }

            case 'text_delta':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + (data.text as string) } : m
                )
              );
              break;

            case 'tool_call':
              setMessages((prev) => [
                ...prev,
                {
                  id: `tool-call-${data.id}`,
                  role: 'tool_call' as const,
                  content: '',
                  toolName: data.name as string,
                  toolArgs: data.args as Record<string, unknown>,
                  createdAt: new Date().toISOString(),
                },
              ]);
              break;

            case 'tool_result': {
              const resultData = data.result as Record<string, unknown> | undefined;
              setMessages((prev) => [
                ...prev,
                {
                  id: `tool-result-${data.id}`,
                  role: 'tool_result' as const,
                  content: '',
                  toolName: data.name as string,
                  toolResult: resultData,
                  displayHint: resultData?.displayHint as string | undefined,
                  createdAt: new Date().toISOString(),
                },
              ]);
              break;
            }

            case 'confirmation_required':
              setPendingConfirmation({
                toolName: data.tool as string,
                toolArgs: data.args as Record<string, unknown>,
                toolUseId: data.toolUseId as string,
              });
              break;

            case 'done':
              // Stream complete
              break;

            case 'error':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content || `Error: ${data.message}` }
                    : m
                )
              );
              setError(data.message as string);
              break;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          parseSSELines(lines, handleSSEEvent);
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
          parseSSELines([buffer], handleSSEEvent);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled — expected
        } else {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `Error: ${errMsg}` } : m))
          );
          setError(errMsg);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, sourceContext, router]
  );

  // Keep ref in sync so confirmAction can call sendMessage
  sendMessageRef.current = sendMessage;

  // ─── Cancel Stream ────────────────────────────────────────────────────────────

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // ─── Confirm Action ───────────────────────────────────────────────────────────

  const confirmAction = useCallback(
    async (toolUseId: string, approved: boolean) => {
      const currentId = conversationIdRef.current;
      if (!currentId || currentId === 'new' || !pendingConfirmation) return;

      const { toolName, toolArgs } = pendingConfirmation;
      setPendingConfirmation(null);

      try {
        const res = await fetch('/api/copilot/confirm-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: currentId,
            toolUseId,
            approved,
            toolName,
            toolArgs,
          }),
        });

        if (res.ok) {
          const data = await res.json();

          if (data.executed && data.result) {
            // Update the awaiting_confirmation tool_result with the real result
            setMessages((prev) =>
              prev.map((m) =>
                m.role === 'tool_result' &&
                m.toolName === toolName &&
                m.toolResult?.awaiting_confirmation
                  ? { ...m, toolResult: data.result, displayHint: data.result.displayHint }
                  : m
              )
            );

            // Resume conversation so Claude can continue
            await sendMessageRef.current(approved ? 'Confirmed.' : 'Cancelled.');
          } else if (!approved) {
            await sendMessageRef.current('The user declined the action.');
          }
        }
      } catch (err) {
        logError('CopilotConversation/confirmAction', err, { toolUseId });
      }
    },
    [pendingConfirmation]
  );

  // ─── Submit Feedback ──────────────────────────────────────────────────────────

  const submitFeedback = useCallback(
    async (messageId: string, rating: 'positive' | 'negative', note?: string) => {
      const currentId = conversationIdRef.current;
      if (!currentId || currentId === 'new') return;

      try {
        await fetch(`/api/copilot/conversations/${currentId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, rating, note }),
        });

        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, feedback: { rating, note } } : m))
        );
      } catch (err) {
        logError('CopilotConversation/submitFeedback', err, { messageId });
      }
    },
    []
  );

  // ─── Delete Conversation ──────────────────────────────────────────────────────

  const deleteConversation = useCallback(async () => {
    const currentId = conversationIdRef.current;
    if (!currentId || currentId === 'new') return;

    try {
      await fetch(`/api/copilot/conversations/${currentId}`, { method: 'DELETE' });
      router.push('/');
    } catch (err) {
      logError('CopilotConversation/deleteConversation', err, { id: currentId });
    }
  }, [router]);

  // ─── Retry After Error ────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove the error assistant message
      setMessages((prev) => {
        const withoutLastAssistant = [...prev];
        const lastIdx = withoutLastAssistant.findLastIndex((m) => m.role === 'assistant');
        if (lastIdx !== -1) withoutLastAssistant.splice(lastIdx, 1);
        // Also remove the last user message since sendMessage will re-add it
        const userIdx = withoutLastAssistant.findLastIndex((m) => m.role === 'user');
        if (userIdx !== -1) withoutLastAssistant.splice(userIdx, 1);
        return withoutLastAssistant;
      });
      setError(null);
      sendMessageRef.current(lastUserMsg.content);
    }
  }, [messages]);

  // ─── Initialization ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (initialConversationId === 'new' && initialMessage) {
      // New conversation with initial message — auto-send
      sendMessageRef.current(initialMessage);
    } else if (initialConversationId !== 'new') {
      // Existing conversation — load messages
      loadConversation(initialConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cleanup: abort SSE on unmount ────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ─── Empty State ──────────────────────────────────────────────────────────────

  const isEmpty = messages.length === 0 && !isStreaming && conversationId === 'new';

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push('/')}
          aria-label="Back to home"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <h1 className="flex-1 text-sm font-medium text-foreground truncate">
          {conversationTitle || 'New conversation'}
        </h1>

        {conversationId !== 'new' && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={deleteConversation}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete conversation"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <p className="text-lg font-medium text-foreground mb-1">Start a conversation</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask me anything about your content, leads, campaigns, or strategy.
              </p>
            </div>
          ) : (
            <MessageList
              messages={messages}
              pendingConfirmation={pendingConfirmation}
              onConfirm={confirmAction}
              onFeedback={submitFeedback}
            />
          )}

          {/* Streaming indicator */}
          {isStreaming &&
            messages[messages.length - 1]?.role === 'assistant' &&
            !messages[messages.length - 1]?.content && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
                <span>Thinking...</span>
              </div>
            )}

          {/* Error with retry */}
          {error && !isStreaming && (
            <div className="flex items-center gap-3 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <span className="flex-1">Something went wrong: {error}</span>
              <Button variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto">
          <PromptInput
            onSubmit={sendMessage}
            onCancel={cancelStream}
            isStreaming={isStreaming}
            autoFocus={isEmpty}
          />
        </div>
      </div>
    </div>
  );
}
