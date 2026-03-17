'use client';

import { useState } from 'react';
import { X, Loader2, Brain } from 'lucide-react';
import { Button, Input, Textarea, Label } from '@magnetlab/magnetui';
import * as transcriptsApi from '@/frontend/api/content-pipeline/transcripts';

interface ManualKnowledgeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualKnowledgeModal({ onClose, onSuccess }: ManualKnowledgeModalProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!content.trim() || content.trim().length < 100) {
      setError('Content must be at least 100 characters');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await transcriptsApi.createTranscript({
        transcript: content.trim(),
        title: title.trim() || 'Manual Entry',
        source: 'manual',
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Add Knowledge</h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste any content — meeting notes, research, articles, blog posts, ideas. The AI will
            analyze it, extract knowledge, and generate content ideas.
          </p>

          <div>
            <Label className="mb-1.5">Title (optional)</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sales call notes, Article highlights..."
            />
          </div>

          <div>
            <Label className="mb-1.5">Content</Label>
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setError('');
              }}
              rows={12}
              placeholder="Paste your content here..."
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {content.length} characters{' '}
              {content.length < 100 && content.length > 0 ? '(min 100)' : ''}
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || content.trim().length < 100}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze & Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
