'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import type { EmailFlowStep } from '@/lib/types/email-system';

interface FlowStepCardProps {
  step: EmailFlowStep;
  stepIndex: number;
  flowId: string;
  flowStatus: string;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (updatedStep: EmailFlowStep) => void;
  onDelete: (stepId: string) => void;
}

export function FlowStepCard({
  step,
  stepIndex,
  flowId,
  flowStatus,
  isExpanded,
  onToggle,
  onSave,
  onDelete,
}: FlowStepCardProps) {
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body);
  const [delayDays, setDelayDays] = useState(step.delay_days);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditable = flowStatus === 'draft' || flowStatus === 'paused';

  const hasChanges =
    subject !== step.subject || body !== step.body || delayDays !== step.delay_days;

  const handleCancel = () => {
    setSubject(step.subject);
    setBody(step.body);
    setDelayDays(step.delay_days);
    setError(null);
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/email/flows/${flowId}/steps/${step.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: subject || undefined,
            body: body || undefined,
            delay_days: delayDays,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save step');
      }

      const data = await response.json();
      onSave(data.step);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save step');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/email/flows/${flowId}/steps/${step.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete step');
      }

      onDelete(step.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete step');
      setDeleting(false);
    }
  };

  const delayLabel =
    step.delay_days === 0 ? 'Immediate' : `After ${step.delay_days} day${step.delay_days !== 1 ? 's' : ''}`;

  return (
    <div
      className={`rounded-lg border bg-card overflow-hidden transition-colors ${
        isExpanded ? 'border-l-4 border-l-purple-500' : 'hover:border-l-4 hover:border-l-purple-300'
      }`}
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
            {stepIndex + 1}
          </div>
          <div className="text-left min-w-0">
            <p className="font-medium truncate">
              {step.subject || (
                <span className="text-muted-foreground italic">No subject</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {delayLabel}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {isEditable ? (
            <>
              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email content..."
                  rows={8}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-y min-h-[200px]"
                />
              </div>

              {/* Delay days */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Days after previous step
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={delayDays}
                  onChange={(e) =>
                    setDelayDays(Math.max(0, Math.min(365, parseInt(e.target.value) || 0)))
                  }
                  className="w-24 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
                <p className="text-xs text-muted-foreground">
                  0 = send immediately. Otherwise, wait this many days after the previous email.
                </p>
              </div>

              {/* Personalization hint */}
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Use{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {'{{first_name}}'}
                  </code>{' '}
                  and{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {'{{email}}'}
                  </code>{' '}
                  for personalization.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Save'
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving || !hasChanges}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>

                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Are you sure?
                    </span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Delete'
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Read-only view for active flows */
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {step.subject || (
                    <span className="text-muted-foreground italic">No subject</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body</label>
                <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/50 p-4 rounded-lg">
                  {step.body || (
                    <span className="text-muted-foreground italic">No content</span>
                  )}
                </pre>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Delay</label>
                <p className="text-sm text-muted-foreground">{delayLabel}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
