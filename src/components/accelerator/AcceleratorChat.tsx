'use client';

/** AcceleratorChat. Full-screen chat interface for the GTM Accelerator.
 *  Uses the same copilot SSE protocol as CopilotProvider. Never imports
 *  NextRequest, NextResponse, or cookies. */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CopilotMessage } from '../copilot/CopilotMessage';
import type { CopilotMessage as CopilotMessageType } from '../copilot/CopilotProvider';
import { useAcceleratorChat } from './useAcceleratorChat';
import type { ModuleId } from '@/lib/types/accelerator';

// ─── Types ───────────────────────────────────────────────

export interface AcceleratorChatProps {
  conversationId: string | null;
  onConversationId: (id: string) => void;
  onStateChange?: () => void;
  enrollmentId?: string;
  needsOnboarding?: boolean;
  focusModule?: ModuleId | null;
  onFocusHandled?: () => void;
}

// ─── Component ───────────────────────────────────────────

export default function AcceleratorChat({
  conversationId,
  onConversationId,
  onStateChange,
  enrollmentId,
  needsOnboarding,
  focusModule,
  onFocusHandled,
}: AcceleratorChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    subAgentActive,
    connectionError,
    sendMessage,
    retryLastMessage,
    handleFeedback,
  } = useAcceleratorChat({
    conversationId,
    onConversationId,
    onStateChange,
    enrollmentId,
    needsOnboarding,
    focusModule,
    onFocusHandled,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
      setInput('');
    }
  };

  const handleSend = () => {
    sendMessage(input);
    setInput('');
  };

  const handleApply = (type: string, data: unknown) => {
    sendMessage(`[Action: ${type}] ${JSON.stringify(data)}`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Sub-agent indicator */}
      {subAgentActive && (
        <div className="flex items-center gap-2 border-b bg-violet-50 px-4 py-2 text-xs text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className="shrink-0 animate-spin text-violet-500"
            style={{ animationDuration: '2s' }}
          >
            <circle
              cx="7"
              cy="7"
              r="5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="12 20"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-medium">{subAgentActive}</span>
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

      {/* Retry banner */}
      {connectionError && (
        <div className="flex items-center justify-between border-t bg-red-50 px-4 py-2 dark:bg-red-900/20">
          <span className="text-xs text-red-600 dark:text-red-400">
            Connection lost. Your last message was not delivered.
          </span>
          <button
            onClick={retryLastMessage}
            disabled={isLoading}
            className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
              <path
                d="M1.5 6a4.5 4.5 0 0 1 7.7-3.2M10.5 6a4.5 4.5 0 0 1-7.7 3.2"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M9.5 1v2.5H7"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2.5 11V8.5H5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Retry
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-background px-4 py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Waiting for response...' : 'Ask your GTM coach anything...'}
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
              <path
                d="M1 7h10M8 4l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
