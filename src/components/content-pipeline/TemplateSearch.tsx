'use client';

import { useState, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface MatchedTemplate {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  structure: string;
  tags: string[] | null;
  similarity: number;
  source: string;
}

interface TemplateSearchProps {
  onSelect?: (template: MatchedTemplate) => void;
}

export function TemplateSearch({ onSelect }: TemplateSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchedTemplate[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const response = await fetch('/api/content-pipeline/templates/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: query.trim(), count: 5, minSimilarity: 0.2 }),
      });
      const data = await response.json();
      setResults(data.matches || []);
    } catch {
      // Silent failure
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search templates by topic (press Enter)..."
          className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Search'}
        </button>
      </div>

      {/* Results */}
      {searching && (
        <div className="mt-4 flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No matching templates found. Try a different topic.</p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {results.length} match{results.length !== 1 ? 'es' : ''} found
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {results.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  if (onSelect) {
                    onSelect(template);
                  } else {
                    setExpandedId(expandedId === template.id ? null : template.id);
                  }
                }}
                className="w-full rounded-lg border bg-card p-3 text-left hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold truncate">{template.name}</h4>
                    <div className="mt-1 flex items-center gap-2">
                      {template.category && (
                        <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {template.category}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {Math.round(template.similarity * 100)}% match
                      </span>
                    </div>
                  </div>
                  {/* Similarity indicator */}
                  <div
                    className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{
                      backgroundColor:
                        template.similarity >= 0.7
                          ? '#22c55e'
                          : template.similarity >= 0.4
                            ? '#eab308'
                            : '#94a3b8',
                    }}
                  />
                </div>
                {template.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                )}
                {expandedId === template.id && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                    {template.structure}
                  </pre>
                )}
                {template.tags && template.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 4 && (
                      <span className="text-xs text-muted-foreground">+{template.tags.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
