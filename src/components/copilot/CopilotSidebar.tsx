'use client';

import React, { useEffect, useRef } from 'react';
import { X, Plus, MessageSquare, ChevronLeft, Trash2 } from 'lucide-react';
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

  const activeConversation = conversations.find(c => c.id === activeConversationId);

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
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={close}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 z-50 flex flex-col shadow-2xl">
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              AI Co-pilot
            </h2>
            <button
              onClick={close}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="Close co-pilot"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        {activeConversationId ? (
          // Active conversation view
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map(msg => (
                <CopilotMessageComponent
                  key={msg.id}
                  message={msg}
                  onFeedback={(rating, note) => submitFeedback(msg.id, rating, note)}
                  onApply={applyToPage ?? undefined}
                />
              ))}
              {isStreaming && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
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
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
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
              <button
                onClick={() => {
                  startNewConversation();
                  // No need to set activeConversationId — sendMessage will create one
                }}
                className="w-full flex items-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Conversation
              </button>
            </div>
            <div className="space-y-1 px-2">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  onClick={() => selectConversation(conv.id)}
                >
                  <MessageSquare className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {conv.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-8">
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
