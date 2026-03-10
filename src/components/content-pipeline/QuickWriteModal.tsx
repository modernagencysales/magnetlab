'use client';

import { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { Button, Input, Textarea, Label } from '@magnetlab/magnetui';
import * as quickWriteApi from '@/frontend/api/content-pipeline/quick-write';

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
      const data = await quickWriteApi.quickWrite({
        raw_thought: rawThought,
        target_audience: targetAudience || undefined,
        profileId: profileId ?? undefined,
      });
      setResult(data as typeof result);
      onPostCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Write"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Quick Write</h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div>
              <Label className="mb-1">What do you want to post about?</Label>
              <Textarea
                value={rawThought}
                onChange={(e) => setRawThought(e.target.value)}
                placeholder="Type a rough idea, question, or observation..."
                className="h-24 resize-none"
              />
            </div>
            <div>
              <Label className="mb-1">Target audience (optional)</Label>
              <Input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Agency owners, SaaS founders..."
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={loading || !rawThought.trim()}
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
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                Generated Topic
              </p>
              <p className="text-sm font-medium">{result.synthetic_idea.title}</p>
              <p className="text-xs text-muted-foreground">{result.synthetic_idea.content_type}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                Post Preview
              </p>
              <div className="max-h-60 overflow-y-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
                {result.post.final_content || result.post.draft_content}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Post saved to your Posts tab.</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setResult(null);
                  setRawThought('');
                }}
              >
                Write Another
              </Button>
              <Button className="flex-1" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
