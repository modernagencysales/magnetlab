'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/analytics/StatCards';
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart';
import { UTMBreakdown } from '@/components/analytics/UTMBreakdown';
import { BarChart3, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';

type Range = '7d' | '30d' | '90d';

interface OverviewData {
  viewsByDay: Array<{ date: string; views: number }>;
  leadsByDay: Array<{ date: string; leads: number }>;
  utmBreakdown: Array<{ source: string; count: number }>;
  totals: {
    views: number;
    leads: number;
    qualified: number;
    conversionRate: number;
    qualificationRate: number;
  };
  contentStats?: {
    posts: {
      total: number;
      draft: number;
      review: number;
      scheduled: number;
      published: number;
    };
    transcripts: number;
    knowledgeEntries: number;
  };
}

interface FunnelItem {
  id: string;
  slug: string;
  optin_headline: string | null;
  is_published: boolean;
  lead_magnets: { title: string } | null;
  libraries: { name: string; icon: string | null } | null;
  external_resources: { title: string; icon: string | null } | null;
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-2 h-7 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* UTM skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function getFunnelName(funnel: FunnelItem): string {
  if (funnel.optin_headline) return funnel.optin_headline;
  if (funnel.lead_magnets?.title) return funnel.lead_magnets.title;
  if (funnel.libraries?.name) return funnel.libraries.name;
  if (funnel.external_resources?.title) return funnel.external_resources.title;
  return funnel.slug;
}

export function AnalyticsOverview() {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [funnels, setFunnels] = useState<FunnelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async (selectedRange: Range) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analytics/overview?range=${selectedRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFunnels = useCallback(async () => {
    try {
      const response = await fetch('/api/funnel/all');
      if (response.ok) {
        const json = await response.json();
        setFunnels(json.funnels || []);
      }
    } catch {
      // Non-critical -- funnels list is supplementary
    }
  }, []);

  useEffect(() => {
    fetchOverview(range);
  }, [range, fetchOverview]);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

  const handleRangeChange = (newRange: Range) => {
    setRange(newRange);
  };

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleRangeChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              range === option.value
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          {/* Stat cards */}
          <StatCards totals={data.totals} />

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Page Views</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeSeriesChart
                  data={data.viewsByDay.map((d) => ({
                    date: d.date,
                    value: d.views,
                  }))}
                  label="Views"
                  color="hsl(221, 83%, 53%)"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads Captured</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeSeriesChart
                  data={data.leadsByDay.map((d) => ({
                    date: d.date,
                    value: d.leads,
                  }))}
                  label="Leads"
                  color="hsl(142, 71%, 45%)"
                />
              </CardContent>
            </Card>
          </div>

          {/* UTM Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Traffic Sources (UTM)</CardTitle>
            </CardHeader>
            <CardContent>
              <UTMBreakdown data={data.utmBreakdown} />
            </CardContent>
          </Card>

          {/* Content Pipeline */}
          {data.contentStats && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold">Content Pipeline</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Published Posts</p>
                  <p className="mt-1 text-2xl font-bold">{data.contentStats.posts.published}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.contentStats.posts.total} total
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Draft / Review Posts</p>
                  <p className="mt-1 text-2xl font-bold">
                    {data.contentStats.posts.draft + data.contentStats.posts.review}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.contentStats.posts.scheduled} scheduled
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Knowledge Entries</p>
                  <p className="mt-1 text-2xl font-bold">{data.contentStats.knowledgeEntries}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.contentStats.transcripts} transcript{data.contentStats.transcripts !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Funnel list */}
          {funnels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Funnels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {funnels.map((funnel) => (
                    <Link
                      key={funnel.id}
                      href={`/analytics/funnel/${funnel.id}`}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {getFunnelName(funnel)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            /{funnel.slug}
                            {!funnel.is_published && (
                              <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                                Draft
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Empty state when data loaded but no views/leads */}
      {!loading && data && data.totals.views === 0 && data.totals.leads === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No analytics data yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Once visitors view your funnel pages and submit leads, your metrics
            will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
