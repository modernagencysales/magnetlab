'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import type { WritingStyle } from '@/lib/types/content-pipeline';

export function StylesSection() {
  const [styles, setStyles] = useState<WritingStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExtract, setShowExtract] = useState(false);
  const [extractPosts, setExtractPosts] = useState('');
  const [extractAuthor, setExtractAuthor] = useState('');
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStyles = useCallback(async () => {
    try {
      const response = await fetch('/api/content-pipeline/styles');
      const data = await response.json();
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
    const posts = extractPosts
      .split('---')
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    if (posts.length === 0) {
      setError('Paste at least one post. Separate multiple posts with ---');
      return;
    }

    setExtracting(true);
    setError(null);

    try {
      const response = await fetch('/api/content-pipeline/styles/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts,
          author_name: extractAuthor || undefined,
          source_linkedin_url: extractUrl || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Extraction failed');
      }

      setShowExtract(false);
      setExtractPosts('');
      setExtractAuthor('');
      setExtractUrl('');
      await fetchStyles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/content-pipeline/styles/${id}`, { method: 'DELETE' });
      await fetchStyles();
    } catch {
      // Silent failure
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Writing Styles</h3>
        <button
          onClick={() => setShowExtract(!showExtract)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-3 w-3" />
          Extract from LinkedIn
        </button>
      </div>

      {showExtract && (
        <div className="mb-4 rounded-lg border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Author Name</label>
              <input
                type="text"
                value={extractAuthor}
                onChange={(e) => setExtractAuthor(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">LinkedIn URL (optional)</label>
              <input
                type="text"
                value={extractUrl}
                onChange={(e) => setExtractUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Posts (separate with ---)</label>
            <textarea
              value={extractPosts}
              onChange={(e) => setExtractPosts(e.target.value)}
              placeholder={"First post content here...\n---\nSecond post content here...\n---\nThird post..."}
              rows={6}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {extracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Extract Style'
            )}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : styles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No writing styles yet. Extract from LinkedIn posts.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {styles.map((style) => (
            <div key={style.id} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold">{style.name}</h4>
                  {style.source_linkedin_url && (
                    <p className="text-xs text-muted-foreground truncate">{style.source_linkedin_url}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(style.id)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {style.description && (
                <p className="mb-2 text-xs text-muted-foreground">{style.description}</p>
              )}
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {style.style_profile?.tone}
                </span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                  {style.style_profile?.vocabulary}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                  {style.source_posts_analyzed} posts analyzed
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
