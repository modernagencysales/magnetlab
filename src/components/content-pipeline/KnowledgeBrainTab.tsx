'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KnowledgeEntryCard } from './KnowledgeEntryCard';
import type { KnowledgeCategory } from '@/lib/types/content-pipeline';

const CATEGORIES: { value: KnowledgeCategory | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'insight', label: 'Insights' },
  { value: 'question', label: 'Questions' },
  { value: 'product_intel', label: 'Product Intel' },
];

interface KnowledgeEntryResult {
  id: string;
  category: KnowledgeCategory;
  content: string;
  context: string | null;
  tags: string[];
  similarity?: number;
}

export function KnowledgeBrainTab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory | ''>('');
  const [entries, setEntries] = useState<KnowledgeEntryResult[]>([]);
  const [tags, setTags] = useState<{ tag_name: string; usage_count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const fetchEntries = useCallback(async (searchQuery: string, cat: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (cat) params.append('category', cat);

      const response = await fetch(`/api/content-pipeline/knowledge?${params}`);
      const data = await response.json();
      setEntries(data.entries || []);
      setTotalCount(data.total_count || 0);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch('/api/content-pipeline/knowledge?view=tags');
      const data = await response.json();
      setTags(data.tags || []);
    } catch {
      // Silent failure
    }
  }, []);

  useEffect(() => {
    fetchEntries('', '');
    fetchTags();
  }, [fetchEntries, fetchTags]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      fetchEntries(value, category);
    }, 400);
    setSearchTimeout(timeout);
  };

  const handleCategoryChange = (cat: KnowledgeCategory | '') => {
    setCategory(cat);
    fetchEntries(query, cat);
  };

  return (
    <div>
      {/* Hero Section */}
      <div className="mb-6 rounded-xl border bg-card p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Brain</h2>
            <p className="text-sm text-muted-foreground">
              {totalCount} insights from your transcripts
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search your knowledge base..."
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="mb-6 flex gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryChange(cat.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              category === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Brain className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">
            {query ? 'No results found' : 'No knowledge entries yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {query ? 'Try a different search term' : 'Upload transcripts to build your knowledge base'}
          </p>
        </div>
      ) : (
        <div>
          {/* Tag Cloud (browse mode) */}
          {!query && tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {tags.slice(0, 20).map((tag) => (
                <button
                  key={tag.tag_name}
                  onClick={() => handleSearchChange(tag.tag_name)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  {tag.tag_name}
                  <span className="ml-1 text-muted-foreground/50">({tag.usage_count})</span>
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="space-y-3">
            {entries.map((entry) => (
              <KnowledgeEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
