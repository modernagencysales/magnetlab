'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, Search, Loader2, ChevronDown, ChevronRight, Sparkles, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KnowledgeEntryCard } from './KnowledgeEntryCard';
import { ManualKnowledgeModal } from './ManualKnowledgeModal';
import type { KnowledgeCategory, KnowledgeSpeaker } from '@/lib/types/content-pipeline';

const CATEGORIES: { value: KnowledgeCategory | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'insight', label: 'Insights' },
  { value: 'question', label: 'Questions' },
  { value: 'product_intel', label: 'Product Intel' },
];

const SPEAKERS: { value: KnowledgeSpeaker | ''; label: string }[] = [
  { value: '', label: 'All Speakers' },
  { value: 'host', label: 'Host' },
  { value: 'participant', label: 'Participant' },
  { value: 'unknown', label: 'Unknown' },
];

interface KnowledgeEntryResult {
  id: string;
  category: KnowledgeCategory;
  content: string;
  context: string | null;
  tags: string[];
  similarity?: number;
}

interface TagCluster {
  id: string;
  name: string;
  description: string | null;
  tags: Array<{ tag_name: string; usage_count: number }>;
}

export function KnowledgeBrainTab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory | ''>('');
  const [speaker, setSpeaker] = useState<KnowledgeSpeaker | ''>('');
  const [activeTag, setActiveTag] = useState('');
  const [entries, setEntries] = useState<KnowledgeEntryResult[]>([]);
  const [tags, setTags] = useState<{ tag_name: string; usage_count: number }[]>([]);
  const [clusters, setClusters] = useState<TagCluster[]>([]);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const fetchEntries = useCallback(async (searchQuery: string, cat: string, spk: string = '', tag: string = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (cat) params.append('category', cat);
      if (spk) params.append('speaker', spk);
      if (tag) params.append('tag', tag);

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

  const fetchClusters = useCallback(async () => {
    try {
      const response = await fetch('/api/content-pipeline/knowledge/clusters');
      const data = await response.json();
      setClusters(data.clusters || []);
    } catch {
      // Silent failure
    }
  }, []);

  useEffect(() => {
    fetchEntries('', '');
    fetchTags();
    fetchClusters();
  }, [fetchEntries, fetchTags, fetchClusters]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setActiveTag(''); // Clear tag filter when typing
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchEntries(value, category, speaker, '');
    }, 400);
  };

  const handleCategoryChange = (cat: KnowledgeCategory | '') => {
    setCategory(cat);
    fetchEntries(query, cat, speaker, activeTag);
  };

  const handleSpeakerChange = (spk: KnowledgeSpeaker | '') => {
    setSpeaker(spk);
    fetchEntries(query, category, spk, activeTag);
  };

  const handleTagClick = (tagName: string) => {
    if (activeTag === tagName) {
      setActiveTag('');
      fetchEntries(query, category, speaker, '');
    } else {
      setActiveTag(tagName);
      setQuery(''); // Clear text search when clicking a tag
      fetchEntries('', category, speaker, tagName);
    }
  };

  const handleOrganizeTags = async () => {
    setClustering(true);
    try {
      await fetch('/api/content-pipeline/knowledge/clusters', { method: 'POST' });
      await fetchClusters();
      await fetchTags();
    } catch {
      // Silent failure
    } finally {
      setClustering(false);
    }
  };

  const toggleCluster = (clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  // Find unclustered tags
  const clusteredTagNames = new Set(clusters.flatMap((c) => c.tags.map((t) => t.tag_name)));
  const unclusteredTags = tags.filter((t) => !clusteredTagNames.has(t.tag_name));

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

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
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

        <span className="mx-1 text-muted-foreground/30">|</span>

        {SPEAKERS.map((spk) => (
          <button
            key={spk.value}
            onClick={() => handleSpeakerChange(spk.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              speaker === spk.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            {spk.label}
          </button>
        ))}

        {activeTag && (
          <>
            <span className="mx-1 text-muted-foreground/30">|</span>
            <button
              onClick={() => handleTagClick(activeTag)}
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              {activeTag} &times;
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 && !tags.length ? (
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
          {/* Tag Clusters + Cloud (browse mode) */}
          {!query && tags.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Knowledge Topics</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualEntry(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add Knowledge
                  </button>
                  <button
                    onClick={handleOrganizeTags}
                    disabled={clustering || tags.length < 4}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    {clustering ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {clustering ? 'Organizing...' : 'Organize Tags'}
                  </button>
                </div>
              </div>

              {/* Cluster Groups */}
              {clusters.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {clusters.map((cluster) => (
                    <div key={cluster.id} className="rounded-lg border bg-card">
                      <button
                        onClick={() => toggleCluster(cluster.id)}
                        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expandedClusters.has(cluster.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">{cluster.name}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {cluster.tags.length}
                          </span>
                        </div>
                        {cluster.description && (
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {cluster.description}
                          </span>
                        )}
                      </button>
                      {expandedClusters.has(cluster.id) && (
                        <div className="flex flex-wrap gap-2 px-3 pb-3">
                          {cluster.tags.map((tag) => (
                            <button
                              key={tag.tag_name}
                              onClick={() => handleTagClick(tag.tag_name)}
                              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                            >
                              {tag.tag_name}
                              <span className="ml-1 text-muted-foreground/50">({tag.usage_count})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Unclustered tags */}
                  {unclusteredTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {unclusteredTags.slice(0, 15).map((tag) => (
                        <button
                          key={tag.tag_name}
                          onClick={() => handleTagClick(tag.tag_name)}
                          className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                        >
                          {tag.tag_name}
                          <span className="ml-1 text-muted-foreground/50">({tag.usage_count})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Flat tag cloud (no clusters yet) */
                <div className="mb-6 flex flex-wrap gap-2">
                  {tags.slice(0, 20).map((tag) => (
                    <button
                      key={tag.tag_name}
                      onClick={() => handleTagClick(tag.tag_name)}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      {tag.tag_name}
                      <span className="ml-1 text-muted-foreground/50">({tag.usage_count})</span>
                    </button>
                  ))}
                  {tags.length >= 4 && (
                    <button
                      onClick={handleOrganizeTags}
                      disabled={clustering}
                      className="rounded-full border border-dashed border-primary/30 px-3 py-1 text-xs text-primary hover:bg-primary/5 transition-colors"
                    >
                      {clustering ? 'Organizing...' : 'Organize into topics'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          <div className="space-y-3">
            {entries.map((entry) => (
              <KnowledgeEntryCard
                key={entry.id}
                entry={entry}
                onUpdate={(id, updated) => {
                  setEntries((prev) =>
                    prev.map((e) => (e.id === id ? { ...e, ...updated } : e))
                  );
                  fetchTags();
                }}
                onDelete={(id) => {
                  setEntries((prev) => prev.filter((e) => e.id !== id));
                  setTotalCount((c) => Math.max(0, c - 1));
                  fetchTags();
                }}
              />
            ))}
          </div>
        </div>
      )}

      {showManualEntry && (
        <ManualKnowledgeModal
          onClose={() => setShowManualEntry(false)}
          onSuccess={() => {
            fetchEntries(query, category);
            fetchTags();
          }}
        />
      )}
    </div>
  );
}
