/**
 * useInlineCopilot.
 * Simplified SSE streaming hook for inline copilot in content queue.
 * No router dependencies, no URL manipulation.
 * Intercepts update_queue_post_content tool calls for diff preview.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { confirmAction as apiConfirmAction } from '@/frontend/api/copilot';
import { logError } from '@/lib/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InlineMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface PendingEdit {
  postId: string;
  proposedContent: string;
  toolUseId: string;
  conversationId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
}

interface SSEEventData {
  [key: string]: unknown;
}

interface UseInlineCopilotProps {
  postId: string;
  postContent: string;
  teamName: string;
  authorName: string;
}

// ─── SSE Parser ─────────────────────────────────────────────────────────────

function parseSSELines(
  lines: string[],
  handler: (eventType: string, data: SSEEventData) => void
): void {
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

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useInlineCopilot({
  postId,
  postContent,
  teamName,
  authorName,
}: UseInlineCopilotProps) {
  const [messages, setMessages] = useState<InlineMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string>('new');
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Reset state when postId changes
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    setPendingEdit(null);
    conversationIdRef.current = 'new';
  }, [postId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ─── Send Message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);

      // Add user message optimistically
      const userMsg: InlineMessage = {
        id: `inline-user-${Date.now()}`,
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Assistant placeholder
      const assistantMsgId = `inline-assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        const body: Record<string, unknown> = {
          message: text,
          conversationId: conversationIdRef.current,
          sourceContext: {
            page: 'content-queue',
            entityType: 'queue_post',
            entityId: postId,
            entityTitle: `${authorName} — ${teamName}`,
            entityContent: postContent,
          },
          pageContext: {
            page: 'content-queue',
            entityType: 'queue_post',
            entityId: postId,
            entityTitle: `${authorName} — ${teamName}`,
          },
        };

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

        const handleSSEEvent = (eventType: string, data: SSEEventData) => {
          switch (eventType) {
            case 'conversation_id':
              conversationIdRef.current = data.conversationId as string;
              break;

            case 'text_delta':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + (data.text as string) } : m
                )
              );
              break;

            case 'confirmation_required': {
              // Intercept update_queue_post_content for diff preview
              const toolName = data.tool as string;
              if (toolName === 'update_queue_post_content') {
                const args = data.args as Record<string, unknown>;
                setPendingEdit({
                  postId: args.post_id as string,
                  proposedContent: args.content as string,
                  toolUseId: data.toolUseId as string,
                  conversationId: conversationIdRef.current,
                  toolName,
                  toolArgs: args,
                });
              }
              break;
            }

            case 'done':
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

        if (buffer.trim()) {
          parseSSELines([buffer], handleSSEEvent);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled or post changed — expected
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
    [isStreaming, postId, postContent, teamName, authorName]
  );

  sendMessageRef.current = sendMessage;

  // ─── Accept / Reject Edit ─────────────────────────────────────────────

  const acceptEdit = useCallback(async () => {
    if (!pendingEdit) return;
    const { conversationId, toolUseId, toolName, toolArgs } = pendingEdit;
    const proposedContent = pendingEdit.proposedContent;
    setPendingEdit(null);

    try {
      await apiConfirmAction(conversationId, toolUseId, true, toolName, toolArgs);
      // Resume conversation
      await sendMessageRef.current('Confirmed.');
      return proposedContent;
    } catch (err) {
      logError('useInlineCopilot/acceptEdit', err, { toolUseId });
      setError('Failed to apply edit. Please try again.');
      return undefined;
    }
  }, [pendingEdit]);

  const rejectEdit = useCallback(async () => {
    if (!pendingEdit) return;
    const { conversationId, toolUseId, toolName, toolArgs } = pendingEdit;
    setPendingEdit(null);

    try {
      await apiConfirmAction(conversationId, toolUseId, false, toolName, toolArgs);
      await sendMessageRef.current('The user rejected the edit. Ask what they would like changed.');
    } catch (err) {
      logError('useInlineCopilot/rejectEdit', err, { toolUseId });
    }
  }, [pendingEdit]);

  // ─── Cancel Stream ────────────────────────────────────────────────────

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    pendingEdit,
    sendMessage,
    acceptEdit,
    rejectEdit,
    cancelStream,
  };
}
