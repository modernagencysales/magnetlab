/** CopilotNavigator. Lightweight copilot provider — navigation + page context only. Constraint: No streaming, no message state. */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PageContext {
  page: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
}

interface CopilotNavigatorContextValue {
  startConversation: (message: string, context?: PageContext) => void;
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const CopilotNavigatorContext = createContext<CopilotNavigatorContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function CopilotNavigatorProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pageContext, setPageContext] = useState<PageContext | null>(null);

  const startConversation = useCallback(
    (message: string, context?: PageContext) => {
      const url = context
        ? `/copilot/new?message=${encodeURIComponent(message)}&context=${encodeURIComponent(JSON.stringify(context))}`
        : `/copilot/new?message=${encodeURIComponent(message)}`;
      router.push(url);
    },
    [router]
  );

  const value = useMemo(
    () => ({ startConversation, pageContext, setPageContext }),
    [startConversation, pageContext, setPageContext]
  );

  return (
    <CopilotNavigatorContext.Provider value={value}>{children}</CopilotNavigatorContext.Provider>
  );
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useCopilotNavigator(): CopilotNavigatorContextValue {
  const ctx = useContext(CopilotNavigatorContext);
  if (!ctx) throw new Error('useCopilotNavigator must be used within CopilotNavigatorProvider');
  return ctx;
}

/**
 * Register page context for the copilot navigator.
 * Drop-in replacement for useCopilotContext — same signature, no sidebar dependency.
 * Cleans up (sets null) on unmount.
 */
export function useCopilotPageContext(context: PageContext) {
  const { setPageContext } = useCopilotNavigator();

  // Use individual primitive fields rather than the `context` object itself — callers create a
  // new inline object on every render so the object reference is always different, but the
  // meaningful values are stable.  This prevents the effect from firing on every render.
  useEffect(() => {
    setPageContext(context);
    return () => setPageContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.page, context.entityType, context.entityId, context.entityTitle, setPageContext]);
}
