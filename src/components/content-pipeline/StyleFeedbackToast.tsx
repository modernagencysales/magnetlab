'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Check, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_TAGS = [
  'Too formal',
  'Too long',
  'Wrong tone',
  'Missing story',
  'Too salesy',
  'Good as-is',
] as const;

interface StyleFeedbackToastProps {
  editId: string;
  onDismiss: () => void;
}

export function StyleFeedbackToast({ editId, onDismiss }: StyleFeedbackToastProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Auto-dismiss after success
  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(onDismiss, 1500);
      return () => clearTimeout(timer);
    }
  }, [submitted, onDismiss]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const canSubmit = selectedTags.length > 0 || note.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/content-pipeline/edit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editId,
          tags: selectedTags,
          note: note.trim() || null,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch {
      // Silent failure — feedback is non-critical
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in">
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-lg dark:border-green-800 dark:bg-green-950/80">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">Feedback saved</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 animate-in slide-in-from-bottom-4 fade-in">
      <div className="rounded-xl border border-border bg-background p-4 shadow-lg">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">How was this edit?</span>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-lg p-1 hover:bg-secondary transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Quick-tag chips */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              )}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Optional note toggle + input */}
        {!showNote ? (
          <button
            onClick={() => setShowNote(true)}
            className="mb-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Add a note
          </button>
        ) : (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What would you change?"
            rows={2}
            className="mb-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Submit Feedback'
          )}
        </button>
      </div>
    </div>
  );
}
