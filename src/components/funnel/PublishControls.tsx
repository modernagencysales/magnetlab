'use client';

import { useState } from 'react';
import { Globe, Copy, Check, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import type { FunnelPage } from '@/lib/types/funnel';

interface PublishControlsProps {
  funnel: FunnelPage;
  setFunnel: (funnel: FunnelPage) => void;
  username: string | null;
}

export function PublishControls({
  funnel,
  setFunnel,
  username,
}: PublishControlsProps) {
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = username
    ? `${window.location.origin}/p/${username}/${funnel.slug}`
    : null;

  const handleTogglePublish = async () => {
    setPublishing(true);
    setError(null);

    try {
      const response = await fetch(`/api/funnel/${funnel.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: !funnel.isPublished }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update publish status');
      }

      const { funnel: updatedFunnel } = await response.json();
      setFunnel(updatedFunnel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update publish status');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = publicUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${funnel.isPublished ? 'bg-green-500' : 'bg-zinc-400'}`} />
          <h3 className="font-semibold">
            {funnel.isPublished ? 'Published' : 'Not Published'}
          </h3>
        </div>
        <button
          onClick={handleTogglePublish}
          disabled={publishing || !username}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            funnel.isPublished
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {funnel.isPublished ? 'Unpublish' : 'Publish'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {!username && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You need to set a username before publishing.
            </p>
            <a
              href="/settings"
              className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >
              Go to Settings &rarr;
            </a>
          </div>
        </div>
      )}

      {funnel.isPublished && publicUrl && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-muted-foreground">
            Public URL
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm font-mono truncate">
              {publicUrl}
            </div>
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </div>
        </div>
      )}

      {funnel.publishedAt && (
        <p className="text-xs text-muted-foreground">
          First published: {new Date(funnel.publishedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
