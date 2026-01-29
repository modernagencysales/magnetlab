'use client';

import { useState } from 'react';
import { Loader2, Sparkles, ExternalLink, CheckCircle2, Clock, FileText } from 'lucide-react';
import type { LeadMagnet, PolishedContent } from '@/lib/types/lead-magnet';

interface ContentPageTabProps {
  leadMagnet: LeadMagnet;
  username: string | null;
  slug: string | null;
  onPolished: (polishedContent: PolishedContent, polishedAt: string) => void;
}

export function ContentPageTab({ leadMagnet, username, slug, onPolished }: ContentPageTabProps) {
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExtracted = !!leadMagnet.extractedContent;
  const hasPolished = !!leadMagnet.polishedContent;
  const polished = leadMagnet.polishedContent as PolishedContent | null;
  const contentUrl = username && slug ? `/p/${username}/${slug}/content` : null;

  const handlePolish = async () => {
    setPolishing(true);
    setError(null);

    try {
      const response = await fetch(`/api/lead-magnet/${leadMagnet.id}/polish`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to polish content');
      }

      const { polishedContent, polishedAt } = await response.json();
      onPolished(polishedContent, polishedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to polish content');
    } finally {
      setPolishing(false);
    }
  };

  if (!hasExtracted) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Content Page</h3>
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <p>Generate content first in the wizard to enable the content page.</p>
          <p className="text-sm mt-2">
            The content page renders your lead magnet as a beautiful, readable article.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Content Page</h3>
      <p className="text-sm text-muted-foreground">
        Polish your extracted content into a beautiful, Notion-like reading experience with AI.
      </p>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Primary action: Open content page (when polished) */}
      {contentUrl && hasPolished && (
        <a
          href={contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-medium text-white hover:bg-violet-600 transition-colors w-full"
        >
          <ExternalLink className="h-4 w-4" />
          Open Content Page
        </a>
      )}

      {/* Polish status */}
      {hasPolished && polished ? (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Content polished</span>
          </div>

          {leadMagnet.polishedAt && (
            <p className="text-xs text-muted-foreground">
              Last polished: {new Date(leadMagnet.polishedAt).toLocaleString()}
            </p>
          )}

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {polished.sections.length} sections
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {polished.metadata.readingTimeMinutes} min read
            </span>
            <span>
              {polished.metadata.wordCount.toLocaleString()} words
            </span>
          </div>
        </div>
      ) : null}

      {/* Secondary: Polish / Re-polish */}
      <button
        onClick={handlePolish}
        disabled={polishing}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          hasPolished
            ? 'border hover:bg-muted/50'
            : 'bg-violet-500 text-white hover:bg-violet-600'
        } disabled:opacity-50`}
      >
        {polishing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {hasPolished ? 'Re-polish Content' : 'Polish Content with AI'}
      </button>
    </div>
  );
}
