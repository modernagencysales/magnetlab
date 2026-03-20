/** CopilotConversation. Full-page conversation view. Pure rendering — all state and logic lives in useConversationStream. */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import { MessageList } from './MessageList';
import { PromptInput } from './PromptInput';
import { useConversationStream } from './useConversationStream';

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

// ─── Component ──────────────────────────────────────────────────────────────────

export function CopilotConversation({
  conversationId: initialConversationId,
  initialMessage,
  sourceContext,
}: CopilotConversationProps) {
  const router = useRouter();

  const {
    messages,
    conversationId,
    conversationTitle,
    isStreaming,
    error,
    pendingConfirmation,
    sendMessage,
    cancelStream,
    confirmAction,
    submitFeedback,
    deleteConversation,
    retry,
    handleContentApprove,
    handleContentRequestChanges,
    isEmpty,
  } = useConversationStream({
    conversationId: initialConversationId,
    initialMessage,
    sourceContext,
  });

  // ─── Render ─────────────────────────────────────────────────────────────────

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
              onContentApprove={handleContentApprove}
              onContentRequestChanges={handleContentRequestChanges}
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
