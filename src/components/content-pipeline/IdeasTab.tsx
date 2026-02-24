'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Loader2, Search, Filter, ChevronDown, ChevronUp, Archive } from 'lucide-react';
import { cn, truncate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { PillarBadge } from './PillarBadge';
import { IdeaDetailModal } from './IdeaDetailModal';
import type { ContentIdea, IdeaStatus, ContentPillar, ContentType } from '@/lib/types/content-pipeline';

const STATUSES: { value: IdeaStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'extracted', label: 'Extracted' },
  { value: 'writing', label: 'Writing' },
  { value: 'written', label: 'Written' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const PILLARS: { value: ContentPillar | ''; label: string }[] = [
  { value: '', label: 'All Pillars' },
  { value: 'moments_that_matter', label: 'Moments That Matter' },
  { value: 'teaching_promotion', label: 'Teaching & Promotion' },
  { value: 'human_personal', label: 'Human & Personal' },
  { value: 'collaboration_social_proof', label: 'Collaboration & Social Proof' },
];

const CONTENT_TYPES: { value: ContentType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'story', label: 'Story' },
  { value: 'insight', label: 'Insight' },
  { value: 'tip', label: 'Tip' },
  { value: 'framework', label: 'Framework' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'question', label: 'Question' },
  { value: 'listicle', label: 'Listicle' },
  { value: 'contrarian', label: 'Contrarian' },
];

interface IdeasTabProps {
  profileId?: string | null;
}

export function IdeasTab({ profileId }: IdeasTabProps) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pillarFilter, setPillarFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'newest' | 'type'>('score');
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null);
  const [writingId, setWritingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const fetchIdeas = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (pillarFilter) params.append('pillar', pillarFilter);
      if (typeFilter) params.append('content_type', typeFilter);
      if (profileId) params.append('team_profile_id', profileId);

      const response = await fetch(`/api/content-pipeline/ideas?${params}`);
      const data = await response.json();
      setIdeas(data.ideas || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pillarFilter, typeFilter, profileId]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const handleWritePost = async (ideaId: string) => {
    setWritingId(ideaId);
    // Optimistically update the idea status to 'writing'
    setIdeas((prev) => prev.map((idea) =>
      idea.id === ideaId ? { ...idea, status: 'writing' as IdeaStatus } : idea
    ));
    try {
      const response = await fetch(`/api/content-pipeline/ideas/${ideaId}/write`, {
        method: 'POST',
      });

      if (response.ok) {
        // Silent refetch — no full-page loader
        await fetchIdeas(true);
        setSelectedIdea(null);
      } else {
        // Revert on failure
        await fetchIdeas(true);
      }
    } catch {
      await fetchIdeas(true);
    } finally {
      setWritingId(null);
    }
  };

  const handleArchive = async (ideaId: string) => {
    setArchivingId(ideaId);
    // Optimistically remove the idea from the list
    setIdeas((prev) => prev.filter((idea) => idea.id !== ideaId));
    setSelectedIdea(null);
    try {
      const response = await fetch('/api/content-pipeline/ideas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId, status: 'archived' }),
      });
      if (!response.ok) {
        await fetchIdeas(true);
      }
    } catch {
      await fetchIdeas(true);
    } finally {
      setArchivingId(null);
    }
  };

  const filteredIdeas = (searchQuery
    ? ideas.filter((idea) =>
        idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        idea.core_insight?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ideas
  ).slice().sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return (b.composite_score ?? 0) - (a.composite_score ?? 0);
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'type':
        return (a.content_type ?? '').localeCompare(b.content_type ?? '');
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search ideas..."
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'score' | 'newest' | 'type')}
              className="appearance-none rounded-lg border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="score">Highest Score</option>
              <option value="newest">Newest</option>
              <option value="type">Content Type</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors',
              showFilters && 'bg-muted'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="relative">
              <select
                value={pillarFilter}
                onChange={(e) => setPillarFilter(e.target.value)}
                className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Ideas Grid */}
      {filteredIdeas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No ideas found</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {ideas.length === 0 ? 'Process transcripts to extract content ideas' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredIdeas.map((idea) => (
            <div
              key={idea.id}
              className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 cursor-pointer"
              onClick={() => setSelectedIdea(idea)}
            >
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <PillarBadge pillar={idea.content_pillar} />
                <StatusBadge status={idea.status} />
                {idea.composite_score != null && (
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    idea.composite_score >= 7 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                    idea.composite_score >= 4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  )}>
                    {idea.composite_score.toFixed(1)}
                  </span>
                )}
                {(idea as ContentIdea & { profile_name?: string | null }).profile_name && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {(idea as ContentIdea & { profile_name?: string | null }).profile_name}
                  </span>
                )}
              </div>

              <h3 className="mb-1 font-medium text-sm">{idea.title}</h3>

              {idea.core_insight && (
                <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                  {truncate(idea.core_insight, 150)}
                </p>
              )}

              {idea.hook && (
                <p className="mb-3 border-l-2 border-primary pl-2 text-xs italic text-muted-foreground line-clamp-2">
                  {idea.hook}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {idea.content_type && (
                    <span className="text-xs text-muted-foreground">{idea.content_type}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {idea.status !== 'archived' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(idea.id);
                      }}
                      disabled={archivingId === idea.id}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                      title="Archive idea"
                    >
                      {archivingId === idea.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {(idea.status === 'extracted' || idea.status === 'selected') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWritePost(idea.id);
                      }}
                      disabled={writingId === idea.id}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {writingId === idea.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Write Post'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onWritePost={handleWritePost}
          onArchive={handleArchive}
          writing={writingId === selectedIdea.id}
          archiving={archivingId === selectedIdea.id}
        />
      )}
    </div>
  );
}
