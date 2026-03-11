'use client';

/** AcceleratorPage. Main layout: chat (left) + progress panel (right).
 *  Loads program state, manages conversation, refreshes on state changes.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { useState, useEffect, useCallback } from 'react';
import AcceleratorChat from './AcceleratorChat';
import EnrollmentCTA from './EnrollmentCTA';
import ProgressPanel from './ProgressPanel';
import { getProgramState } from '@/frontend/api/accelerator';
import type { ProgramState, ModuleId } from '@/lib/types/accelerator';

// ─── Types ───────────────────────────────────────────────

interface AcceleratorPageProps {
  userId: string;
}

// ─── Component ───────────────────────────────────────────

export default function AcceleratorPage({ userId: _userId }: AcceleratorPageProps) {
  const [programState, setProgramState] = useState<ProgramState | null>(null);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProgramState = useCallback(async () => {
    try {
      const data = await getProgramState();
      setEnrolled(data.enrolled ?? false);
      setProgramState(data.programState ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load program state:', msg);
      setError(`Failed to load your program: ${msg}. Please try again.`);
    }
  }, []);

  useEffect(() => {
    loadProgramState();
  }, [loadProgramState]);

  const [focusModule, setFocusModule] = useState<ModuleId | null>(null);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <svg
            aria-hidden="true"
            width="32"
            height="32"
            viewBox="0 0 16 16"
            className="mx-auto mb-3 text-red-400"
          >
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
          </svg>
          <p className="mb-4 text-sm text-red-600">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadProgramState();
            }}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (enrolled === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your program...</p>
        </div>
      </div>
    );
  }

  if (!enrolled) {
    return <EnrollmentCTA />;
  }

  const needsOnboarding = enrolled && !programState?.enrollment?.intake_data?.business_description;

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <AcceleratorChat
          conversationId={conversationId}
          onConversationId={setConversationId}
          onStateChange={loadProgramState}
          enrollmentId={programState?.enrollment?.id}
          needsOnboarding={needsOnboarding}
          focusModule={focusModule}
          onFocusHandled={() => setFocusModule(null)}
        />
      </div>

      {/* Progress panel */}
      <ProgressPanel programState={programState} onModuleClick={setFocusModule} />
    </div>
  );
}
