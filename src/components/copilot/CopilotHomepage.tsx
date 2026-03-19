/** CopilotHomepage. Copilot-centered homepage with prompt box, suggestion chips, stats, and recent conversations. Constraint: No raw fetch(), uses useHomepageData + useCopilotNavigator. */

'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useHomepageData } from '@/frontend/hooks/api/useHomepageData';
import { useCopilotNavigator } from '@/components/copilot/CopilotNavigator';
import { SuggestionChips } from '@/components/copilot/SuggestionChips';
import { StatsCards } from '@/components/copilot/StatsCards';
import { ConversationList } from '@/components/copilot/ConversationList';

// ─── Greeting ─────────────────────────────────────────────

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// ─── Skeleton ─────────────────────────────────────────────

function HomepageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 gap-8">
      <div className="max-w-2xl mx-auto w-full flex flex-col items-center gap-8">
        {/* Greeting skeleton */}
        <div className="text-center space-y-2">
          <div className="bg-muted animate-pulse rounded h-9 w-72 mx-auto" />
          <div className="bg-muted animate-pulse rounded h-4 w-56 mx-auto" />
        </div>
        {/* Prompt box skeleton */}
        <div className="bg-muted animate-pulse rounded-xl h-16 w-full" />
        {/* Chips skeleton */}
        <div className="flex gap-2 flex-wrap justify-center max-w-lg mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted animate-pulse rounded-full h-9 w-32" />
          ))}
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto w-full">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted animate-pulse rounded-lg h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────

export function CopilotHomepage() {
  const router = useRouter();
  const { startConversation } = useCopilotNavigator();
  const { data, isLoading, error, mutate } = useHomepageData();
  const [prompt, setPrompt] = useState('');

  const userName = data?.userName ?? 'there';
  const timeOfDay = getTimeOfDay();
  const greeting = `Good ${timeOfDay}, ${userName}`;

  const summaryLine =
    data?.suggestions && data.suggestions.length > 0
      ? data.suggestions
          .slice(0, 3)
          .map((s) => s.label)
          .join(' · ')
      : null;

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setPrompt('');
    startConversation(trimmed);
  }, [prompt, startConversation]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleChipClick = useCallback(
    (action: string) => {
      startConversation(action);
    },
    [startConversation]
  );

  const handleConversationSelect = useCallback(
    (id: string) => {
      router.push(`/copilot/${id}`);
    },
    [router]
  );

  if (isLoading) return <HomepageSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 gap-4">
        <p className="text-sm text-muted-foreground">Unable to load dashboard</p>
        <button onClick={() => mutate()} className="text-sm text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 gap-8">
      <div className="max-w-2xl mx-auto w-full flex flex-col items-center gap-8">
        {/* ── Greeting ─────────────────────────────────────────────────────── */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-foreground">{greeting}</h1>
          {summaryLine && <p className="mt-1 text-sm text-muted-foreground">{summaryLine}</p>}
        </div>

        {/* ── Prompt box ───────────────────────────────────────────────────── */}
        <div className="w-full">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to work on?"
            rows={2}
            className="bg-card border border-border rounded-xl px-5 py-4 text-base w-full resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-foreground"
          />
        </div>

        {/* ── Suggestion chips ──────────────────────────────────────────────── */}
        {data.suggestions.length > 0 && (
          <SuggestionChips suggestions={data.suggestions} onSelect={handleChipClick} />
        )}

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {data.stats.length > 0 && <StatsCards stats={data.stats} />}

        {/* ── Recent conversations ──────────────────────────────────────────── */}
        {data.recentConversations.length > 0 && (
          <div className="w-full max-w-lg mx-auto">
            <p className="text-sm text-muted-foreground mb-2">Recent conversations</p>
            <ConversationList
              conversations={data.recentConversations}
              onSelect={handleConversationSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}
