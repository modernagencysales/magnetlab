'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Sparkles, ExternalLink, CheckCircle2, Clock, FileText, PenLine } from 'lucide-react';
import type { LeadMagnet, PolishedContent, ExtractedContent } from '@/lib/types/lead-magnet';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 10 * 60 * 1000; // 10 minutes

interface ContentPageTabProps {
  leadMagnet: LeadMagnet;
  username: string | null;
  slug: string | null;
  onPolished: (polishedContent: PolishedContent, polishedAt: string, extractedContent?: ExtractedContent) => void;
}

function createBlankContent(title: string): PolishedContent {
  return {
    version: 1,
    polishedAt: new Date().toISOString(),
    title,
    heroSummary: '',
    sections: [{
      id: `section-${Date.now()}`,
      sectionName: 'Introduction',
      introduction: '',
      keyTakeaway: '',
      blocks: [{ type: 'paragraph', content: '' }],
    }],
    metadata: { wordCount: 0, readingTimeMinutes: 0 },
  };
}

export function ContentPageTab({ leadMagnet, username, slug, onPolished }: ContentPageTabProps) {
  const [polishing, setPolishing] = useState(false);
  const [generating, setGenerating] = useState(leadMagnet.status === 'processing');
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);

  const hasExtracted = !!leadMagnet.extractedContent;
  const hasPolished = !!leadMagnet.polishedContent;
  const hasConcept = !!leadMagnet.concept;
  const polished = leadMagnet.polishedContent as PolishedContent | null;
  const contentUrl = username && slug ? `/p/${username}/${slug}/content` : null;
  const isAiLoading = polishing || generating;

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollForCompletion = useCallback(() => {
    pollStart.current = Date.now();
    pollTimer.current = setInterval(async () => {
      // Timeout guard
      if (Date.now() - pollStart.current > POLL_MAX_MS) {
        stopPolling();
        setGenerating(false);
        setError('Content generation is taking longer than expected. Please refresh the page to check.');
        return;
      }

      try {
        const res = await fetch(`/api/lead-magnet/${leadMagnet.id}`);
        if (!res.ok) return; // Retry on next tick

        const data = await res.json();
        const lm = data.leadMagnet ?? data;

        if (lm.polished_content || lm.polishedContent) {
          stopPolling();
          setGenerating(false);
          const pc = lm.polished_content || lm.polishedContent;
          const pa = lm.polished_at || lm.polishedAt || new Date().toISOString();
          const ec = lm.extracted_content || lm.extractedContent;
          onPolished(pc, pa, ec);
        } else if (lm.status !== 'processing') {
          // Status changed but no polished content — task may have failed
          stopPolling();
          setGenerating(false);
          setError('Content generation failed. Please try again.');
        }
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [leadMagnet.id, onPolished, stopPolling]);

  // Resume polling if component mounts while already processing
  useEffect(() => {
    if (leadMagnet.status === 'processing' && !pollTimer.current) {
      setGenerating(true);
      pollForCompletion();
    }
    return () => stopPolling();
  }, [leadMagnet.status, pollForCompletion, stopPolling]);

  const handlePolish = async () => {
    setPolishing(true);
    setError(null);

    try {
      const response = await fetch(`/api/lead-magnet/${leadMagnet.id}/polish`, {
        method: 'POST',
      });

      if (!response.ok) {
        const text = await response.text();
        let message = 'Failed to polish content';
        try { message = JSON.parse(text).error || message; } catch {}
        throw new Error(message);
      }

      const { polishedContent, polishedAt } = await response.json();
      onPolished(polishedContent, polishedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to polish content');
    } finally {
      setPolishing(false);
    }
  };

  const handleGenerateAndPolish = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/lead-magnet/${leadMagnet.id}/generate-content`, {
        method: 'POST',
      });

      if (!response.ok) {
        const text = await response.text();
        let message = 'Failed to generate content';
        try { message = JSON.parse(text).error || message; } catch {}
        throw new Error(message);
      }

      // API now returns { status: 'processing' } — start polling
      pollForCompletion();
    } catch (err) {
      setGenerating(false);
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    }
  };

  const handleStartBlank = () => {
    // Create blank content, save it, then redirect to inline editor
    const blank = createBlankContent(leadMagnet.title);
    setError(null);
    (async () => {
      try {
        const now = new Date().toISOString();
        const contentToSave = { ...blank, polishedAt: now };
        const response = await fetch(`/api/lead-magnet/${leadMagnet.id}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ polishedContent: contentToSave }),
        });
        if (!response.ok) {
          const text = await response.text();
          let message = 'Failed to create content';
          try { message = JSON.parse(text).error || message; } catch {}
          throw new Error(message);
        }
        const { polishedContent: saved } = await response.json();
        onPolished(saved, now);
        // Redirect to inline editor
        if (contentUrl) {
          window.open(`${contentUrl}?edit=true`, '_blank');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create content');
      }
    })();
  };

  // Empty state: no polished content yet
  if (!hasPolished) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Content Page</h3>
        <p className="text-sm text-muted-foreground">
          Create a content page for your lead magnet — write it yourself or generate with AI.
        </p>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {hasExtracted && !hasPolished && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Content will be auto-formatted when you publish. You can also polish it manually below.
          </div>
        )}

        <div className={`grid gap-4 ${hasConcept ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
          {/* Card A: Write Your Own */}
          <button
            onClick={handleStartBlank}
            disabled={isAiLoading}
            className="group rounded-lg border border-dashed p-6 text-left hover:border-violet-500/50 hover:bg-violet-500/5 transition-colors disabled:opacity-50"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <PenLine className="h-5 w-5 text-violet-500" />
            </div>
            <p className="font-medium">Write Your Own</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a blank template and write your content manually using the block editor.
            </p>
          </button>

          {/* Card B: Generate with AI (only shown when concept exists) */}
          {hasConcept && (
            <button
              onClick={hasExtracted ? handlePolish : handleGenerateAndPolish}
              disabled={isAiLoading}
              className="group rounded-lg border border-dashed p-6 text-left hover:border-violet-500/50 hover:bg-violet-500/5 transition-colors disabled:opacity-50"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                {isAiLoading ? (
                  <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5 text-violet-500" />
                )}
              </div>
              <p className="font-medium">Generate with AI</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAiLoading
                  ? 'Generating your content page — this usually takes 2-4 minutes...'
                  : hasExtracted
                    ? 'Polish your extracted content into a beautiful reading experience.'
                    : 'Generate a full content page from your lead magnet concept.'}
              </p>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Has polished content
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Content Page</h3>
      <p className="text-sm text-muted-foreground">
        Your content page is ready. Edit it inline or re-generate with AI.
      </p>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Primary action: Open content page (when polished) */}
      {contentUrl && (
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
      {polished && (
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
      )}

      {/* Edit Content link → inline editor on live page */}
      {polished && contentUrl && (
        <a
          href={`${contentUrl}?edit=true`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <PenLine className="h-4 w-4" />
          Edit Content
        </a>
      )}

      {/* Re-polish (only if extracted content exists) */}
      {hasExtracted && (
        <button
          onClick={handlePolish}
          disabled={polishing}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50 disabled:opacity-50"
        >
          {polishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Re-polish Content
        </button>
      )}
    </div>
  );
}
