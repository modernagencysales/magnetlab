'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Loader2, Sparkles, ExternalLink, CheckCircle2, Clock, FileText, PenLine, Save, X } from 'lucide-react';
import type { LeadMagnet, PolishedContent } from '@/lib/types/lead-magnet';
import { EditablePolishedContentRenderer } from '@/components/content/EditablePolishedContentRenderer';

interface ContentPageTabProps {
  leadMagnet: LeadMagnet;
  username: string | null;
  slug: string | null;
  onPolished: (polishedContent: PolishedContent, polishedAt: string) => void;
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
  const { resolvedTheme } = useTheme();
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<PolishedContent | null>(null);
  const [saving, setSaving] = useState(false);

  const isDark = resolvedTheme === 'dark';
  const hasExtracted = !!leadMagnet.extractedContent;
  const hasPolished = !!leadMagnet.polishedContent;
  const polished = leadMagnet.polishedContent as PolishedContent | null;
  const contentUrl = username && slug ? `/p/${username}/${slug}/content` : null;

  if (!hasExtracted) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Content Page</h3>
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <p>No content yet.</p>
          <p className="text-sm mt-2">
            Complete the lead magnet wizard to generate content, or this will be auto-formatted when you publish.
          </p>
        </div>
      </div>
    );
  }

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

  const handleStartEditing = (content: PolishedContent) => {
    setEditContent(JSON.parse(JSON.stringify(content)));
    setIsEditing(true);
    setError(null);
  };

  const handleStartBlank = () => {
    handleStartEditing(createBlankContent(leadMagnet.title));
  };

  const handleDiscard = () => {
    if (!window.confirm('Discard unsaved changes?')) return;
    setEditContent(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editContent) return;
    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const contentToSave = { ...editContent, polishedAt: now };
      const response = await fetch(`/api/lead-magnet/${leadMagnet.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polishedContent: contentToSave }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save content');
      }

      const { polishedContent } = await response.json();
      onPolished(polishedContent, now);
      setIsEditing(false);
      setEditContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  // Inline editor view
  if (isEditing && editContent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Edit Content</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="rounded-lg border p-4">
          <EditablePolishedContentRenderer
            content={editContent}
            isDark={isDark}
            primaryColor="#8b5cf6"
            onChange={setEditContent}
          />
        </div>
      </div>
    );
  }

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

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Card A: Write Your Own */}
          <button
            onClick={handleStartBlank}
            className="group rounded-lg border border-dashed p-6 text-left hover:border-violet-500/50 hover:bg-violet-500/5 transition-colors"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <PenLine className="h-5 w-5 text-violet-500" />
            </div>
            <p className="font-medium">Write Your Own</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a blank template and write your content manually using the block editor.
            </p>
          </button>

          {/* Card B: Generate with AI */}
          <button
            onClick={handlePolish}
            disabled={polishing}
            className="group rounded-lg border border-dashed p-6 text-left hover:border-violet-500/50 hover:bg-violet-500/5 transition-colors disabled:opacity-50"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              {polishing ? (
                <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5 text-violet-500" />
              )}
            </div>
            <p className="font-medium">Generate with AI</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {polishing
                ? 'Generating your content page...'
                : 'Polish your extracted content into a beautiful reading experience.'}
            </p>
          </button>
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

      {/* Edit Content button */}
      {polished && (
        <button
          onClick={() => handleStartEditing(polished)}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <PenLine className="h-4 w-4" />
          Edit Content
        </button>
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
