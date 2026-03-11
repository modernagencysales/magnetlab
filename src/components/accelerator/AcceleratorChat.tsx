'use client';

/** AcceleratorChat. Full-screen chat interface for the GTM Accelerator.
 *  Uses the same copilot SSE protocol as CopilotProvider. Never imports
 *  NextRequest, NextResponse, or cookies. */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CopilotMessage } from '../copilot/CopilotMessage';
import type { CopilotMessage as CopilotMessageType } from '../copilot/CopilotProvider';

// ─── Types ───────────────────────────────────────────────

interface ChatMessage {
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

export interface AcceleratorChatProps {
  conversationId: string | null;
  onConversationId: (id: string) => void;
  onStateChange?: () => void;
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

// ─── Component ───────────────────────────────────────────

export default function AcceleratorChat({
  conversationId,
  onConversationId,
  onStateChange,
}: AcceleratorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [subAgentActive, setSubAgentActive] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsStreaming(true);

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
            pageContext: { page: 'accelerator' },
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
              if (
                [
                  'create_deliverable',
                  'update_module_progress',
                  'validate_deliverable',
                  'save_intake_data',
                ].includes(data.name as string)
              ) {
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
        setIsStreaming(false);
        // Clean up empty assistant messages left behind
        setMessages((prev) => prev.filter((m) => m.role !== 'assistant' || m.content.trim()));
      }
    },
    [isStreaming, conversationId, onConversationId, onStateChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleApply = (type: string, data: unknown) => {
    sendMessage(`[Action: ${type}] ${JSON.stringify(data)}`);
  };

  const handleFeedback = (_rating: 'positive' | 'negative', _note?: string) => {
    // Feedback handling — can be expanded to POST /api/copilot/conversations/:id/feedback
  };

  return (
    <div className="flex h-full flex-col">
      {/* Sub-agent indicator */}
      {subAgentActive && (
        <div className="flex items-center gap-2 border-b bg-violet-50 px-4 py-2 text-xs text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500" />
          {subAgentActive}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.map((msg) => (
            <CopilotMessage
              key={msg.id}
              message={msg as CopilotMessageType}
              onFeedback={handleFeedback}
              onApply={handleApply}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-background px-4 py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response...' : 'Ask your GTM coach anything...'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
