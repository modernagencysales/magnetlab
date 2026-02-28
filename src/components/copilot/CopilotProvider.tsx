'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// ============================================
// TYPES
// ============================================

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  feedback?: { rating: 'positive' | 'negative'; note?: string };
  displayHint?: string;
  createdAt: string;
}

export interface CopilotConversation {
  id: string;
  title: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  updatedAt: string;
}

interface PageContext {
  page: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
}

export interface PendingConfirmation {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolUseId: string;
}

type ApplyHandler = (type: string, data: unknown) => void;

interface CopilotContextValue {
  // Panel state
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  // Conversation state
  conversations: CopilotConversation[];
  activeConversationId: string | null;
  messages: CopilotMessage[];
  isStreaming: boolean;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  cancelStream: () => void;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 'positive' | 'negative', note?: string) => Promise<void>;

  // Page context
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;

  // Confirmation
  pendingConfirmation: PendingConfirmation | null;
  confirmAction: (toolUseId: string, approved: boolean) => Promise<void>;

  // Apply to page
  applyToPage: ApplyHandler | null;
  registerApplyHandler: (handler: ApplyHandler | null) => void;
}

// ============================================
// CONTEXT
// ============================================

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
}

// ============================================
// SSE EVENT HANDLER
// ============================================

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

// ============================================
// PROVIDER
// ============================================

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const applyHandlerRef = useRef<ApplyHandler | null>(null);
  const [applyToPage, setApplyToPage] = useState<ApplyHandler | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/copilot/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations.map((c: Record<string, unknown>) => ({
          id: c.id,
          title: c.title,
          entityType: c.entity_type,
          entityId: c.entity_id,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })));
      }
    } catch {
      /* ignore fetch errors */
    }
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    try {
      const res = await fetch(`/api/copilot/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((data.messages || []).map((m: Record<string, unknown>) => ({
          id: m.id,
          role: m.role,
          content: m.content || '',
          toolName: m.tool_name,
          toolArgs: m.tool_args as Record<string, unknown> | undefined,
          toolResult: m.tool_result as Record<string, unknown> | undefined,
          feedback: m.feedback as CopilotMessage['feedback'],
          createdAt: m.created_at,
        })));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await fetch(`/api/copilot/conversations/${id}`, { method: 'DELETE' });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
  }, [activeConversationId]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const confirmAction = useCallback(async (toolUseId: string, approved: boolean) => {
    if (!activeConversationId) return;

    try {
      await fetch('/api/copilot/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId,
          toolUseId,
          approved,
        }),
      });
    } catch {
      /* ignore fetch errors */
    } finally {
      setPendingConfirmation(null);
    }
  }, [activeConversationId]);

  const registerApplyHandler = useCallback((handler: ApplyHandler | null) => {
    applyHandlerRef.current = handler;
    setApplyToPage(() => handler);
  }, []);

  // Auto-load entity-scoped conversations when page context changes
  useEffect(() => {
    if (pageContext?.entityType && pageContext?.entityId && isOpen) {
      fetch(`/api/copilot/conversations?entity_type=${pageContext.entityType}&entity_id=${pageContext.entityId}`)
        .then(res => res.json())
        .then(data => {
          if (data.conversations?.length > 0) {
            selectConversation(data.conversations[0].id);
          }
        })
        .catch(() => {}); // Silently fail — user can start new conversation
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageContext?.entityType, pageContext?.entityId, isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Add user message optimistically
    const userMsg: CopilotMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Prepare streaming assistant message placeholder
    const assistantMsgId = `temp-assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant' as const,
      content: '',
      createdAt: new Date().toISOString(),
    }]);

    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: activeConversationId,
          pageContext,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleSSEEvent: SSEEventHandler = (eventType, data) => {
        switch (eventType) {
          case 'conversation_id':
            setActiveConversationId(data.conversationId as string);
            break;

          case 'text_delta':
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + (data.text as string) }
                : m
            ));
            break;

          case 'tool_call':
            setMessages(prev => [...prev, {
              id: `tool-call-${data.id}`,
              role: 'tool_call' as const,
              content: '',
              toolName: data.name as string,
              toolArgs: data.args as Record<string, unknown>,
              createdAt: new Date().toISOString(),
            }]);
            break;

          case 'tool_result': {
            const resultData = data.result as Record<string, unknown> | undefined;
            setMessages(prev => [...prev, {
              id: `tool-result-${data.id}`,
              role: 'tool_result' as const,
              content: '',
              toolName: data.name as string,
              toolResult: resultData,
              displayHint: resultData?.displayHint as string | undefined,
              createdAt: new Date().toISOString(),
            }]);
            break;
          }

          case 'confirmation_required':
            setPendingConfirmation({
              toolName: data.tool as string,
              toolArgs: data.args as Record<string, unknown>,
              toolUseId: data.toolUseId as string,
            });
            break;

          case 'done':
            loadConversations();
            break;

          case 'error':
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: m.content || `Error: ${data.message}` }
                : m
            ));
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
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled -- expected behavior
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, activeConversationId, pageContext, loadConversations]);

  const submitFeedback = useCallback(async (messageId: string, rating: 'positive' | 'negative', note?: string) => {
    if (!activeConversationId) return;

    await fetch(`/api/copilot/conversations/${activeConversationId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, rating, note }),
    });

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, feedback: { rating, note } } : m
    ));
  }, [activeConversationId]);

  const value: CopilotContextValue = {
    isOpen,
    open,
    close,
    toggle,
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    sendMessage,
    cancelStream,
    loadConversations,
    selectConversation,
    startNewConversation,
    deleteConversation,
    submitFeedback,
    pageContext,
    setPageContext,
    pendingConfirmation,
    confirmAction,
    applyToPage,
    registerApplyHandler,
  };

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
}
