'use client';

/**
 * SuggestionCard. Displays AI coaching analysis and suggested reply.
 * Reasoning is always visible (not collapsed). Actions: copy, use, regenerate.
 * Never imports server-only modules.
 */

import { useState, useCallback } from 'react';
import { Button, CopyButton } from '@magnetlab/magnetui';
import { Check, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as dmCoachApi from '@/frontend/api/dm-coach';
import { useDmCoachStore } from '@/frontend/stores/dm-coach';
import type { DmcSuggestion } from '@/lib/types/dm-coach';
import { ReasoningPanel } from './ReasoningPanel';

// ─── Types ─────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: DmcSuggestion;
  contactId: string;
  onMutate: () => Promise<void>;
}

// ─── Component ─────────────────────────────────────────────────────

export function SuggestionCard({ suggestion, contactId, onMutate }: SuggestionCardProps) {
  const [useLoading, setUseLoading] = useState(false);
  const { suggestionLoading, setSuggestionLoading } = useDmCoachStore();

  const handleUse = useCallback(async () => {
    setUseLoading(true);
    try {
      await dmCoachApi.markSuggestionUsed(contactId, suggestion.id);
      await onMutate();
      toast.success('Reply logged as used');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark suggestion as used');
    } finally {
      setUseLoading(false);
    }
  }, [contactId, suggestion.id, onMutate]);

  const handleRegenerate = useCallback(async () => {
    setSuggestionLoading(true);
    try {
      await dmCoachApi.getSuggestion(contactId);
      await onMutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate suggestion');
    } finally {
      setSuggestionLoading(false);
    }
  }, [contactId, onMutate, setSuggestionLoading]);

  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
      {/* Header */}
      <div className="border-b border-primary/10 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Coaching Analysis
        </h3>
      </div>

      {/* Reasoning (always visible) */}
      <div className="border-b border-primary/10 px-4 py-3">
        <ReasoningPanel
          reasoning={suggestion.reasoning}
          stageBefore={suggestion.stage_before}
          stageAfter={suggestion.stage_after}
        />
      </div>

      {/* Suggested reply */}
      <div className="px-4 py-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested Reply
        </h4>
        <div className="rounded-md border bg-background px-3 py-2.5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {suggestion.suggested_response}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <CopyButton
            value={suggestion.suggested_response}
            variant="outline"
            size="sm"
            label="Copy"
            copiedLabel="Copied"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleUse}
            disabled={useLoading || suggestion.was_used}
          >
            {useLoading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            {suggestion.was_used ? 'Used' : 'Use & Log'}
          </Button>

          <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={suggestionLoading}>
            {suggestionLoading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
