'use client';

import { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';

interface TranscriptPasteModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function TranscriptPasteModal({ onClose, onSuccess }: TranscriptPasteModalProps) {
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (transcript.trim().length < 100) {
      setError('Transcript must be at least 100 characters');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/content-pipeline/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, transcript: transcript.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save transcript');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch {
      setError('Failed to save transcript');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Paste Transcript</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <Check className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 font-medium">Transcript saved!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Processing will begin shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Client Discovery Call"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Transcript *</label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="h-48 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Paste your call transcript here (min 100 characters)..."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {transcript.length} characters {transcript.length < 100 && transcript.length > 0 ? `(${100 - transcript.length} more needed)` : ''}
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || transcript.trim().length < 100}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Process'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
