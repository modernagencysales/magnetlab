'use client';

import { useState } from 'react';
import { FileText, Trash2, Plus, Clock } from 'lucide-react';
import { WIZARD_STEPS } from '@/lib/types/lead-magnet';
import type { WizardDraft } from '@/lib/types/lead-magnet';

interface DraftPickerProps {
  drafts: WizardDraft[];
  onSelect: (draft: WizardDraft) => void;
  onDelete: (id: string) => void;
  onStartNew: () => void;
}

function getStepName(step: number): string {
  const found = WIZARD_STEPS.find((s) => s.id === step);
  return found ? found.name : `Step ${step}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export function DraftPicker({ drafts, onSelect, onDelete, onStartNew }: DraftPickerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setDeletingId(id);
    try {
      const response = await fetch('/api/wizard-draft', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        onDelete(id);
      }
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your Drafts</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick up where you left off, or start a new lead magnet.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="group relative rounded-lg border bg-card p-5 transition-colors hover:border-primary/50"
          >
            <button
              onClick={() => handleDelete(draft.id)}
              disabled={deletingId === draft.id}
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              title={confirmId === draft.id ? 'Click again to confirm' : 'Delete draft'}
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {confirmId === draft.id && (
              <div className="absolute right-10 top-3 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                Click again to delete
              </div>
            )}

            <button
              onClick={() => onSelect(draft)}
              className="w-full text-left"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">
                    {draft.draft_title || 'Untitled Draft'}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">
                      {getStepName(draft.current_step)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(draft.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onStartNew}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-card py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Start New Lead Magnet
      </button>
    </div>
  );
}
