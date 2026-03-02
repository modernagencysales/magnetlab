'use client';

import { useState } from 'react';
import { X, Loader2, Sparkles, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabMode = 'ai' | 'manual';

interface QuickWriteModalProps {
  onClose: () => void;
  onPostCreated: () => void;
  profileId?: string | null;
  scheduledDate?: Date | null;
}

export function QuickWriteModal({ onClose, onPostCreated, profileId, scheduledDate }: QuickWriteModalProps) {
  const [mode, setMode] = useState<TabMode>('ai');
  const [rawThought, setRawThought] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    post: { draft_content: string; final_content: string | null; dm_template: string | null };
    synthetic_idea: { title: string; content_type: string };
  } | null>(null);

  const handleAISubmit = async () => {
    if (!rawThought.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/content-pipeline/quick-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_thought: rawThought,
          target_audience: targetAudience || undefined,
          profileId: profileId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate post');
      }

      const data = await response.json();
      setResult(data);
      onPostCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualContent.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/content-pipeline/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_content: manualContent,
          status: 'draft',
          profileId: profileId || undefined,
          scheduled_time: scheduledDate?.toISOString() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save post');
      }

      onPostCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Quick Write">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Post</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher */}
        {!result && (
          <div className="mb-4 flex rounded-lg border bg-muted/30 p-0.5">
            <button
              onClick={() => setMode('ai')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mode === 'ai' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles className="h-4 w-4" />
              AI Draft
            </button>
            <button
              onClick={() => setMode('manual')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <PenLine className="h-4 w-4" />
              Write Manually
            </button>
          </div>
        )}

        {scheduledDate && !result && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Scheduling for {scheduledDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        )}

        {/* AI Draft tab */}
        {mode === 'ai' && !result && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">What do you want to post about?</label>
              <textarea
                value={rawThought}
                onChange={(e) => setRawThought(e.target.value)}
                placeholder="Type a rough idea, question, or observation..."
                className="h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Target audience (optional)</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Agency owners, SaaS founders..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleAISubmit}
              disabled={loading || !rawThought.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Post
                </>
              )}
            </button>
          </div>
        )}

        {/* Manual Write tab */}
        {mode === 'manual' && !result && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Write your post</label>
              <textarea
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder="Write your LinkedIn post here..."
                className="h-48 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {manualContent.length} characters
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleManualSubmit}
              disabled={loading || !manualContent.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  Save as Draft
                </>
              )}
            </button>
          </div>
        )}

        {/* AI Result view */}
        {result && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Generated Topic</p>
              <p className="text-sm font-medium">{result.synthetic_idea.title}</p>
              <p className="text-xs text-muted-foreground">{result.synthetic_idea.content_type}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Post Preview</p>
              <div className="max-h-60 overflow-y-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
                {result.post.final_content || result.post.draft_content}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Post saved to your Posts tab.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setResult(null);
                  setRawThought('');
                }}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Write Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
