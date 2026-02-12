'use client';

import { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';

interface QuickWriteModalProps {
  onClose: () => void;
  onPostCreated: () => void;
  profileId?: string | null;
}

export function QuickWriteModal({ onClose, onPostCreated, profileId }: QuickWriteModalProps) {
  const [rawThought, setRawThought] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    post: { draft_content: string; final_content: string | null; dm_template: string | null };
    synthetic_idea: { title: string; content_type: string };
  } | null>(null);

  const handleSubmit = async () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Quick Write</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!result ? (
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

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              onClick={handleSubmit}
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
        ) : (
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
