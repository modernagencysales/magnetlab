'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WizardState } from '@/lib/types/lead-magnet';

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
  const abortRef = useRef<AbortController | null>(null);
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

    // Cancel in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSaving(true);
    try {
      const response = await fetch('/api/wizard-draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draftIdRef.current,
          wizardState: stateToSave,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json();
        if (!draftIdRef.current && data.id) {
          setCurrentDraftId(data.id);
          draftIdRef.current = data.id;
        }
        lastSnapshotRef.current = snapshot;
        setLastSavedAt(new Date());
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced auto-save on state change
  useEffect(() => {
    if (!enabled) return;
    // Skip save when on step 1 (brand kit) or step 6 (publish)
    if (state.currentStep <= 1 || state.currentStep >= 6) return;

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
    if (state.currentStep > 1 && state.currentStep < 6) {
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
