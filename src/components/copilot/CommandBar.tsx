/** CommandBar. Global Cmd+K overlay for quick copilot access. Constraint: Must be mounted at layout level. */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCopilotNavigator } from '@/components/copilot/CopilotNavigator';
import { logError } from '@/lib/utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PageContext {
  page: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
}

interface Conversation {
  id: string;
  title: string;
  entity_type: string | null;
  entity_id: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CommandBar() {
  const router = useRouter();
  const { startConversation, pageContext } = useCopilotNavigator();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [capturedContext, setCapturedContext] = useState<PageContext | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Open / close helpers ───────────────────────────────────────────────────

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  // ─── Global keyboard listener ───────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── On open: capture context + fetch recent conversations ─────────────────

  useEffect(() => {
    if (!isOpen) return;

    // Capture page context at open time
    setCapturedContext(pageContext);

    // Fetch recent conversations
    fetch('/api/copilot/conversations?limit=5')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { conversations: Conversation[] }) => {
        setConversations(data.conversations ?? []);
      })
      .catch((err) => {
        logError('CommandBar', err, { step: 'fetch_conversations' });
      });
  }, [isOpen, pageContext]);

  // ─── Auto-focus input when open ────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // ─── Keyboard handlers inside the bar ──────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && query.trim()) {
        startConversation(query.trim(), capturedContext ?? undefined);
        close();
      } else if (e.key === 'Escape') {
        close();
      }
    },
    [query, capturedContext, startConversation, close]
  );

  // ─── Navigation ────────────────────────────────────────────────────────────

  const navigateToConversation = useCallback(
    (id: string) => {
      router.push(`/copilot/${id}`);
      close();
    },
    [router, close]
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={close}
        aria-hidden="true"
      />

      {/* Command bar */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Input row */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask copilot…"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
            />
            <span className="hidden sm:inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded border border-border font-mono">⌘</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border font-mono">K</kbd>
            </span>
          </div>

          {/* Recent conversations */}
          <div className="px-2 py-2 max-h-64 overflow-y-auto">
            <div className="px-2 py-1 text-xs text-muted-foreground">Recent</div>
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No recent conversations</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigateToConversation(conv.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm text-foreground truncate"
                >
                  {conv.title}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
