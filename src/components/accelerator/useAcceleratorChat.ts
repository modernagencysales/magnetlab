/** useAcceleratorChat. Custom hook encapsulating SSE streaming, message state,
 *  and sub-agent tracking for the AcceleratorChat component. Never imports
 *  NextRequest, NextResponse, or cookies. */

import { useState, useCallback } from 'react';

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
}

interface UseAcceleratorChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  subAgentActive: string | null;
  sendMessage: (text: string) => Promise<void>;
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
        /* ignore JSON parse errors */
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
}: UseAcceleratorChatOptions): UseAcceleratorChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subAgentActive, setSubAgentActive] = useState<string | null>(null);

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

      // Placeholder assistant message to stream into
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
      ]);

      try {
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
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant' as const,
            content: `Error: ${err instanceof Error ? err.message : 'Connection failed'}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
        // Clean up empty assistant messages left behind
        setMessages((prev) => prev.filter((m) => m.role !== 'assistant' || m.content.trim()));
      }
    },
    [isLoading, conversationId, onConversationId, onStateChange, enrollmentId]
  );

  const handleFeedback = useCallback((_rating: 'positive' | 'negative', _note?: string) => {
    // Feedback handling — can be expanded to POST /api/copilot/conversations/:id/feedback
  }, []);

  return { messages, isLoading, subAgentActive, sendMessage, handleFeedback };
}
