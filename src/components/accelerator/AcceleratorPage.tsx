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

  const loadProgramState = useCallback(async () => {
    try {
      const data = await getProgramState();
      setEnrolled(data.enrolled ?? false);
      setProgramState(data.programState ?? null);
    } catch (err) {
      console.error('Failed to load program state', err);
      setEnrolled(false);
    }
  }, []);

  useEffect(() => {
    loadProgramState();
  }, [loadProgramState]);

  const [focusModule, setFocusModule] = useState<ModuleId | null>(null);

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
