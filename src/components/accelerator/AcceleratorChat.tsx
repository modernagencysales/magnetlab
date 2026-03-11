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

  const { messages, isLoading, subAgentActive, sendMessage, handleFeedback } = useAcceleratorChat({
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
            <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
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
