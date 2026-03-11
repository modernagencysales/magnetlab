/** useAcceleratorChat. Custom hook encapsulating SSE streaming, message state,
 *  and sub-agent tracking for the AcceleratorChat component. Never imports
 *  NextRequest, NextResponse, or cookies. */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ModuleId } from '@/lib/types/accelerator';
import { MODULE_NAMES } from '@/lib/types/accelerator';
import { getConversation } from '@/frontend/api/accelerator';

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  displayHint?: string;
  subAgent?: string;
  createdAt: string;
}

interface UseAcceleratorChatOptions {
  conversationId: string | null;
  onConversationId: (id: string) => void;
  onStateChange?: () => void;
  enrollmentId?: string;
  needsOnboarding?: boolean;
  focusModule?: ModuleId | null;
  onFocusHandled?: () => void;
}

interface UseAcceleratorChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  subAgentActive: string | null;
  connectionError: boolean;
  sendMessage: (text: string) => Promise<void>;
  retryLastMessage: () => void;
  handleFeedback: (rating: 'positive' | 'negative', note?: string) => void;
}

// ─── SSE Parsing ─────────────────────────────────────────

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
        console.warn('SSE parse error', { line });
      }
      currentEvent = '';
    } else if (line === '') {
      // Empty line resets event state per SSE spec
      currentEvent = '';
    }
  }
}

// ─── Hook ────────────────────────────────────────────────

const STATE_CHANGE_TOOLS = [
  'create_deliverable',
  'update_module_progress',
  'validate_deliverable',
  'save_intake_data',
];

export function useAcceleratorChat({
  conversationId,
  onConversationId,
  onStateChange,
  enrollmentId,
  needsOnboarding,
  focusModule,
  onFocusHandled,
}: UseAcceleratorChatOptions): UseAcceleratorChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subAgentActive, setSubAgentActive] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const historyLoadedRef = useRef(false);

  // Load conversation history on mount when conversationId is available
  useEffect(() => {
    if (!conversationId || historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    getConversation(conversationId)
      .then(({ messages: dbMessages }) => {
        if (!dbMessages?.length) return;
        const hydrated: ChatMessage[] = dbMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .filter((m) => m.content?.trim())
          .map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.created_at,
          }));
        if (hydrated.length > 0) {
          setMessages(hydrated);
        }
      })
      .catch(() => {
        // Conversation may have been deleted — start fresh
        historyLoadedRef.current = false;
      });
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setConnectionError(false);
      setLastUserMessage(text);

      // Placeholder assistant message to stream into
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
      ]);

      try {
        // Raw fetch required: SSE streaming is incompatible with apiClient's JSON response pattern
        const response = await fetch('/api/copilot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversationId,
            pageContext: {
              page: 'accelerator',
              entityType: 'accelerator',
              entityId: enrollmentId || undefined,
            },
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to connect');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        // Tracks the current assistant message ID (may change after tool results)
        let currentAssistantId = assistantMsgId;

        const handleSSEEvent: SSEEventHandler = (eventType, data) => {
          switch (eventType) {
            case 'conversation_id':
              onConversationId(data.conversationId as string);
              break;

            case 'text_delta':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === currentAssistantId
                    ? { ...m, content: m.content + (data.text as string) }
                    : m
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
                  subAgent: data.subAgent as string | undefined,
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
              // Trigger state refresh when program state changes
              if (STATE_CHANGE_TOOLS.includes(data.name as string)) {
                onStateChange?.();
              }
              // Spawn new assistant placeholder after tool result
              currentAssistantId = `assistant-${Date.now()}-${Math.random()}`;
              setMessages((prev) => [
                ...prev,
                {
                  id: currentAssistantId,
                  role: 'assistant' as const,
                  content: '',
                  createdAt: new Date().toISOString(),
                },
              ]);
              break;
            }

            case 'sub_agent_start':
              setSubAgentActive(data.message as string);
              break;

            case 'sub_agent_end':
              setSubAgentActive(null);
              break;

            case 'done':
              break;

            case 'error':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === currentAssistantId
                    ? { ...m, content: m.content || `Error: ${data.message}` }
                    : m
                )
              );
              break;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() || '';
          parseSSELines(lines, handleSSEEvent);
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
          parseSSELines([buffer], handleSSEEvent);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Connection failed';
        setConnectionError(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant' as const,
            content: `Connection lost: ${errorMsg}. Click "Retry" to resend your message.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
        setSubAgentActive(null);
        // Clean up empty assistant messages left behind
        setMessages((prev) => prev.filter((m) => m.role !== 'assistant' || m.content.trim()));
      }
    },
    [isLoading, conversationId, onConversationId, onStateChange, enrollmentId]
  );

  useEffect(() => {
    // Don't auto-send onboarding if we're loading an existing conversation
    if (needsOnboarding && messages.length === 0 && !isLoading && !conversationId) {
      sendMessage("I just enrolled in the GTM Accelerator. Let's start with my onboarding intake.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOnboarding]);

  useEffect(() => {
    if (focusModule && !isLoading) {
      const moduleName = MODULE_NAMES[focusModule];
      sendMessage(`Let's work on ${moduleName} (${focusModule}). What should I focus on next?`);
      onFocusHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusModule]);

  const retryLastMessage = useCallback(() => {
    if (!lastUserMessage || isLoading) return;
    // Remove the error message and the failed user message (sendMessage will re-add it)
    setMessages((prev) => {
      const cleaned = prev.filter((m) => !m.id.startsWith('error-'));
      // Drop the last user message to avoid duplicate after sendMessage re-adds it
      const lastUserIdx = cleaned.findLastIndex((m) => m.role === 'user');
      if (lastUserIdx >= 0) cleaned.splice(lastUserIdx, 1);
      return cleaned;
    });
    sendMessage(lastUserMessage);
  }, [lastUserMessage, isLoading, sendMessage]);

  const handleFeedback = useCallback((_rating: 'positive' | 'negative', _note?: string) => {
    // Feedback handling — can be expanded to POST /api/copilot/conversations/:id/feedback
  }, []);

  return {
    messages,
    isLoading,
    subAgentActive,
    connectionError,
    sendMessage,
    retryLastMessage,
    handleFeedback,
  };
}
