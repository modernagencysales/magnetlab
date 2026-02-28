'use client';

import React from 'react';
import { ThumbsUp, ThumbsDown, Wrench } from 'lucide-react';
import type { CopilotMessage as CopilotMessageType } from './CopilotProvider';

interface CopilotMessageProps {
  message: CopilotMessageType;
  onFeedback: (rating: 'positive' | 'negative', note?: string) => void;
}

export function CopilotMessage({ message, onFeedback }: CopilotMessageProps) {
  if (message.role === 'tool_call') {
    return (
      <div className="flex items-start gap-2 text-xs text-zinc-400 py-1">
        <Wrench className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>Using <strong className="text-zinc-500">{message.toolName}</strong>...</span>
      </div>
    );
  }

  if (message.role === 'tool_result') {
    const result = message.toolResult;
    const success = result && typeof result === 'object' && 'success' in result && result.success;
    return (
      <div className={`text-xs py-1 px-2 rounded ${success ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'}`}>
        {success ? 'Done' : 'Failed'}: {message.toolName}
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {message.content}
      </div>
      {/* Feedback buttons for assistant messages */}
      {message.role === 'assistant' && message.content && (
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={() => onFeedback('positive')}
            className={`p-1 rounded transition-colors ${
              message.feedback?.rating === 'positive'
                ? 'text-emerald-500'
                : 'text-zinc-300 hover:text-zinc-500'
            }`}
            aria-label="Good response"
          >
            <ThumbsUp className="w-3 h-3" />
          </button>
          <button
            onClick={() => onFeedback('negative')}
            className={`p-1 rounded transition-colors ${
              message.feedback?.rating === 'negative'
                ? 'text-red-500'
                : 'text-zinc-300 hover:text-zinc-500'
            }`}
            aria-label="Bad response"
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
