'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WizardState } from '@/lib/types/lead-magnet';
import { logWarn } from '@/lib/utils/logger';
import * as wizardDraftApi from '@/frontend/api/wizard-draft';

interface UseWizardAutoSaveOptions {
  state: WizardState;
  draftId: string | null;
  enabled: boolean;
}

interface UseWizardAutoSaveReturn {
  draftId: string | null;
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
  saveNow: () => void;
}

const DEBOUNCE_MS = 2000;

export function useWizardAutoSave({
  state,
  draftId: initialDraftId,
  enabled,
}: UseWizardAutoSaveOptions): UseWizardAutoSaveReturn {
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(initialDraftId);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotRef = useRef<string>('');
  const draftIdRef = useRef<string | null>(initialDraftId);

  // Keep ref in sync with state
  useEffect(() => {
    draftIdRef.current = currentDraftId;
  }, [currentDraftId]);

  // Sync external draftId changes (e.g. when user picks a draft)
  useEffect(() => {
    setCurrentDraftId(initialDraftId);
    draftIdRef.current = initialDraftId;
    lastSnapshotRef.current = '';
  }, [initialDraftId]);

  const save = useCallback(async (stateToSave: WizardState) => {
    const snapshot = JSON.stringify(stateToSave);
    if (snapshot === lastSnapshotRef.current) {
      setHasUnsavedChanges(false);
      return;
    }

    setIsSaving(true);
    try {
      const data = await wizardDraftApi.saveDraft({
        id: draftIdRef.current ?? undefined,
        wizardState: stateToSave,
      });
      if (!draftIdRef.current && data.id) {
        setCurrentDraftId(data.id);
        draftIdRef.current = data.id;
      }
      lastSnapshotRef.current = snapshot;
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
    } catch (err) {
      logWarn('hooks/useWizardAutoSave', 'Auto-save failed', { error: String(err) });
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced auto-save on state change
  useEffect(() => {
    if (!enabled) return;
    // Skip save on step 6 (publish) — step 1 now auto-saves to preserve business context
    if (state.currentStep >= 6) return;

    const snapshot = JSON.stringify(state);
    if (snapshot === lastSnapshotRef.current) {
      setHasUnsavedChanges(false);
      return;
    }

    setHasUnsavedChanges(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save(state);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, enabled, save]);

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (state.currentStep < 6) {
      save(state);
    }
  }, [state, save]);

  return {
    draftId: currentDraftId,
    isSaving,
    lastSavedAt,
    hasUnsavedChanges,
    saveNow,
  };
}
