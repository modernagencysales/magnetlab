'use client';

/**
 * InspoRecycleTab. Shows winner posts ready for recycling.
 * One-click repost or cousin actions.
 */

import { Badge, Button } from '@magnetlab/magnetui';
import { RotateCcw, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { useRecyclablePosts, useRecyclePost } from '@/frontend/hooks/api/useRecycle';

function extractStat(stats: Record<string, unknown> | null, key: string): number | null {
  if (!stats || !(key in stats)) return null;
  const val = stats[key];
  return typeof val === 'number' ? val : null;
}

function formatNumber(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return `${days}d ago`;
}

export function InspoRecycleTab() {
  const { posts, isLoading, refetch } = useRecyclablePosts();
  const { mutate: recycle, isPending } = useRecyclePost(() => {
    toast.success('Post recycled — sent to content queue');
    refetch();
  });

  const handleRecycle = async (postId: string, type: 'repost' | 'cousin') => {
    try {
      await recycle(postId, type);
    } catch {
      toast.error('Failed to recycle post');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No posts ready for recycling yet.</p>
        <p className="text-sm mt-1">
          Posts with 2×+ average impressions and 7+ days old will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Posts with 2×+ avg impressions, 7+ days old, ready for reuse
      </p>
      <div className="flex flex-col gap-2">
        {posts.map((post) => {
          const content = post.final_content || post.draft_content || '';
          const impressions = extractStat(post.engagement_stats, 'impressions');
          const engRate = extractStat(post.engagement_stats, 'engagement_rate');

          return (
            <div key={post.id} className="p-3.5 border border-border rounded-lg bg-card">
              <p className="text-sm text-foreground line-clamp-2">{content}</p>
              <div className="flex gap-2 mt-2 items-center flex-wrap">
                <Badge variant="gray" className="bg-emerald-500/10 text-emerald-500 text-xs">
                  {formatNumber(impressions)} impr
                </Badge>
                <Badge variant="gray" className="bg-emerald-500/10 text-emerald-500 text-xs">
                  {engRate != null ? `${engRate.toFixed(1)}%` : '—'} eng
                </Badge>
                {post.exploit_name && (
                  <Badge variant="gray" className="text-xs">
                    {post.exploit_name}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{daysAgo(post.published_at)}</span>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-400 border-blue-500/30"
                  onClick={() => handleRecycle(post.id, 'repost')}
                  disabled={isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Repost
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRecycle(post.id, 'cousin')}
                  disabled={isPending}
                >
                  <Shuffle className="h-3.5 w-3.5 mr-1" />
                  Cousin
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
