'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp, Hash, Star, FileText } from 'lucide-react';
import { KnowledgeEntryCard } from './KnowledgeEntryCard';

interface OverviewStats {
  entries_added: number;
  new_topics: string[];
  most_active_topics: Array<{ slug: string; display_name: string; count: number }>;
  highlights: Array<{
    id: string;
    category: 'insight' | 'question' | 'product_intel';
    content: string;
    context: string | null;
    tags: string[];
    knowledge_type?: string | null;
    quality_score?: number | null;
  }>;
}

export function KnowledgeOverview({ teamId }: { teamId?: string }) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [topicCount, setTopicCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (teamId) params.append('team_id', teamId);

      const [digestRes, topicsRes] = await Promise.all([
        fetch(`/api/content-pipeline/knowledge/recent?days=7&${params}`),
        // We fetch topics to get total count — limit is generous but bounded
        fetch(`/api/content-pipeline/knowledge/topics?limit=200&${params}`),
      ]);

      const digest = await digestRes.json();
      const topics = await topicsRes.json();

      setStats(digest);
      setTopicCount(topics.topics?.length || 0);
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={() => fetchData()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Retry</button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={FileText} label="Entries (7d)" value={stats.entries_added} />
        <StatCard icon={Hash} label="Topics" value={topicCount} />
        <StatCard icon={TrendingUp} label="New Topics (7d)" value={stats.new_topics.length} />
        <StatCard icon={Star} label="Highlights (7d)" value={stats.highlights.length} />
      </div>

      {/* Most active topics */}
      {stats.most_active_topics.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Most Active Topics</h3>
          <div className="flex flex-wrap gap-2">
            {stats.most_active_topics.map((topic) => (
              <span
                key={topic.slug}
                className="rounded-full border bg-card px-3 py-1.5 text-sm"
              >
                {topic.display_name}
                <span className="ml-1.5 text-xs text-muted-foreground">({topic.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent highlights */}
      {stats.highlights.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">High-Quality Highlights</h3>
          <div className="space-y-3">
            {stats.highlights.slice(0, 5).map((entry) => (
              <KnowledgeEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
