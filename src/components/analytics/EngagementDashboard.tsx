'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Heart, Send, ArrowLeft, Activity } from 'lucide-react';
import Link from 'next/link';

interface EngagementTotals {
  comments: number;
  reactions: number;
  dmsSent: number;
  dmsFailed: number;
}

interface PostEngagementRow {
  postId: string;
  title: string;
  publishedAt: string | null;
  comments: number;
  reactions: number;
  dmsSent: number;
}

interface EngagementData {
  totals: EngagementTotals;
  byPost: PostEngagementRow[];
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-8 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '--';
  }
}

export function EngagementDashboard() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEngagement = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analytics/engagement');
      if (!response.ok) {
        throw new Error('Failed to fetch engagement data');
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load engagement data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  const hasData =
    data &&
    (data.totals.comments > 0 ||
      data.totals.reactions > 0 ||
      data.totals.dmsSent > 0 ||
      data.byPost.length > 0);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/analytics"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Analytics
      </Link>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-950">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Comments</p>
                    <p className="text-2xl font-bold">{data.totals.comments}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-pink-100 p-2.5 dark:bg-pink-950">
                    <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Reactions</p>
                    <p className="text-2xl font-bold">{data.totals.reactions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-950">
                    <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">DMs Sent</p>
                    <p className="text-2xl font-bold">{data.totals.dmsSent}</p>
                    {data.totals.dmsFailed > 0 && (
                      <p className="text-xs text-red-500">
                        {data.totals.dmsFailed} failed
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-post table */}
          {hasData ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement by Post</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 pr-4 font-medium text-muted-foreground">
                          Post Title
                        </th>
                        <th className="pb-3 pr-4 font-medium text-muted-foreground">
                          Published
                        </th>
                        <th className="pb-3 pr-4 text-right font-medium text-muted-foreground">
                          Comments
                        </th>
                        <th className="pb-3 pr-4 text-right font-medium text-muted-foreground">
                          Reactions
                        </th>
                        <th className="pb-3 text-right font-medium text-muted-foreground">
                          DMs Sent
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byPost.map((post) => (
                        <tr
                          key={post.postId}
                          className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <Link
                              href={`/content/posts/${post.postId}`}
                              className="font-medium hover:text-primary transition-colors line-clamp-1"
                            >
                              {post.title}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                            {formatDate(post.publishedAt)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {post.comments}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {post.reactions}
                          </td>
                          <td className="py-3 text-right tabular-nums">
                            {post.dmsSent}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No engagement data yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Publish posts and enable automations to start tracking comments,
                reactions, and DMs.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
