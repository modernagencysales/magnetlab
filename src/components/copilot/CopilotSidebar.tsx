'use client';

import React, { useEffect, useRef } from 'react';
import { X, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import { useCopilot } from './CopilotProvider';
import { ConversationInput } from './ConversationInput';
import { CopilotMessage as CopilotMessageComponent } from './CopilotMessage';
import { ConversationHeader } from './ConversationHeader';
import { ConfirmationDialog } from './ConfirmationDialog';

export function CopilotSidebar() {
  const {
    isOpen,
    close,
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    loadConversations,
    selectConversation,
    startNewConversation,
    deleteConversation,
    sendMessage,
    cancelStream,
    submitFeedback,
    pageContext,
    pendingConfirmation,
    confirmAction,
    applyToPage,
  } = useCopilot();

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  // Load conversations on first open
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={close} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-background border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        {activeConversationId ? (
          <ConversationHeader
            title={activeConversation?.title}
            entityType={pageContext?.entityType}
            entityTitle={pageContext?.entityTitle}
            onBack={startNewConversation}
            onNewThread={startNewConversation}
          />
        ) : (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">AI Co-pilot</h2>
            <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close co-pilot">
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Content */}
        {activeConversationId ? (
          // Active conversation view
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <CopilotMessageComponent
                  key={msg.id}
                  message={msg}
                  onFeedback={(rating, note) => submitFeedback(msg.id, rating, note)}
                  onApply={applyToPage ?? undefined}
                />
              ))}
              {isStreaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-pulse">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {pendingConfirmation && (
              <ConfirmationDialog
                toolName={pendingConfirmation.toolName}
                toolArgs={pendingConfirmation.toolArgs}
                toolUseId={pendingConfirmation.toolUseId}
                onConfirm={confirmAction}
              />
            )}
            <div className="border-t border-border px-4 py-3">
              <ConversationInput
                onSend={sendMessage}
                onCancel={cancelStream}
                isStreaming={isStreaming}
              />
            </div>
          </>
        ) : (
          // Conversation list view
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <Button
                onClick={() => {
                  startNewConversation();
                  // No need to set activeConversationId — sendMessage will create one
                }}
                className="w-full flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Conversation
              </Button>
            </div>
            <div className="space-y-1 px-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => selectConversation(conv.id)}
                >
                  <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {conv.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 text-muted-foreground group-hover:opacity-100 hover:text-destructive"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No conversations yet. Start one!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
