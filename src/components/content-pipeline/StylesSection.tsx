'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash2, ExternalLink, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { StyleMixer } from './StyleMixer';
import type { WritingStyle, StyleProfile } from '@/lib/types/content-pipeline';

const TONE_COLORS: Record<StyleProfile['tone'], string> = {
  conversational: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  professional: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  provocative: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  educational: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  inspirational: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function StylesSection() {
  const [styles, setStyles] = useState<WritingStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [url, setUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mixerStyleId, setMixerStyleId] = useState<string | null>(null);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/content-pipeline/styles');
      const data = await res.json();
      setStyles(data.styles || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStyles();
  }, [fetchStyles]);

  const handleExtract = async () => {
    if (!url.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/content-pipeline/styles/extract-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: url.trim(),
          author_name: authorName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Extraction failed');
        return;
      }

      toast.success(`Style "${data.style.name}" extracted from ${data.posts_analyzed} posts`);
      setUrl('');
      setAuthorName('');
      await fetchStyles();
    } catch {
      toast.error('Failed to extract style');
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = styles;
    setStyles((s) => s.filter((style) => style.id !== id));

    try {
      const res = await fetch(`/api/content-pipeline/styles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setStyles(prev);
        toast.error('Failed to delete style');
      } else {
        toast.success('Style deleted');
      }
    } catch {
      setStyles(prev);
      toast.error('Failed to delete style');
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Writing Styles</h3>

      {/* Extraction form */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Extract a writing style from any LinkedIn profile URL.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="LinkedIn URL or /in/slug"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={extracting}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <input
            type="text"
            placeholder="Author name (optional)"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            disabled={extracting}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 sm:w-48"
          />
          <button
            onClick={handleExtract}
            disabled={extracting || !url.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {extracting ? 'Extracting...' : 'Extract'}
          </button>
        </div>
        {extracting && (
          <p className="mt-2 text-xs text-muted-foreground animate-pulse">
            Extracting... this takes 15-30 seconds
          </p>
        )}
      </div>

      {/* Styles list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : styles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No writing styles yet. Extract one from a LinkedIn profile above.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {styles.map((style) => {
            const profile = style.style_profile as StyleProfile;
            const isExpanded = expandedId === style.id;

            return (
              <div key={style.id} className="rounded-lg border bg-card p-4">
                {/* Header */}
                <div className="mb-2 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold truncate">{style.name}</h4>
                    {style.source_linkedin_url && (
                      <a
                        href={style.source_linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source profile
                      </a>
                    )}
                  </div>
                  <div className="ml-2 flex items-center gap-1">
                    <button
                      onClick={() => setMixerStyleId(style.id)}
                      className="rounded-lg p-1 text-muted-foreground hover:text-primary transition-colors"
                      title="Apply traits..."
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(style.id)}
                      className="rounded-lg p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Delete style"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Badges */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_COLORS[profile.tone] || 'bg-secondary'}`}>
                    {profile.tone}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {profile.sentence_length} sentences
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {profile.vocabulary}
                  </span>
                </div>

                {/* Formatting flags */}
                <div className="mb-2 flex flex-wrap gap-1">
                  {profile.formatting.uses_emojis && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">emojis</span>
                  )}
                  {profile.formatting.uses_lists && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">lists</span>
                  )}
                  {profile.formatting.uses_bold && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">bold</span>
                  )}
                </div>

                {/* Description */}
                {style.description && (
                  <p className="mb-2 text-xs text-muted-foreground line-clamp-2">{style.description}</p>
                )}

                {/* Hook patterns preview */}
                {profile.hook_patterns && profile.hook_patterns.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Hooks: </span>
                    <span className="text-xs text-muted-foreground">
                      {profile.hook_patterns.slice(0, 2).join(', ')}
                      {profile.hook_patterns.length > 2 && ` +${profile.hook_patterns.length - 2}`}
                    </span>
                  </div>
                )}

                {/* Posts count */}
                <div className="mb-2 text-xs text-muted-foreground">
                  {style.source_posts_analyzed} posts analyzed
                </div>

                {/* Expand/collapse */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : style.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {isExpanded ? 'Less' : 'Details'}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {profile.hook_patterns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">Hook patterns</p>
                        <ul className="mt-1 space-y-0.5">
                          {profile.hook_patterns.map((p, i) => (
                            <li key={i} className="text-xs text-muted-foreground">- {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {profile.cta_patterns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">CTA patterns</p>
                        <ul className="mt-1 space-y-0.5">
                          {profile.cta_patterns.map((p, i) => (
                            <li key={i} className="text-xs text-muted-foreground">- {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {profile.signature_phrases.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">Signature phrases</p>
                        <ul className="mt-1 space-y-0.5">
                          {profile.signature_phrases.map((p, i) => (
                            <li key={i} className="text-xs text-muted-foreground">&ldquo;{p}&rdquo;</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {profile.banned_phrases.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">Avoids</p>
                        <ul className="mt-1 space-y-0.5">
                          {profile.banned_phrases.map((p, i) => (
                            <li key={i} className="text-xs text-muted-foreground line-through">{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Avg {profile.formatting.avg_paragraphs} paragraphs/post
                      {profile.formatting.uses_line_breaks && ' | uses line breaks'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Style Mixer modal */}
      {mixerStyleId && (
        <StyleMixer
          sourceStyle={styles.find(s => s.id === mixerStyleId)!}
          onClose={() => setMixerStyleId(null)}
        />
      )}
    </div>
  );
}
