'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Button,
  StatCard,
  Badge,
  EmptyState,
} from '@magnetlab/magnetui';
import * as analyticsApi from '@/frontend/api/analytics';
import * as funnelApi from '@/frontend/api/funnel';
import { StatCards } from '@/components/analytics/StatCards';
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart';
import { UTMBreakdown } from '@/components/analytics/UTMBreakdown';
import { BarChart3, ExternalLink, FileText, Activity, Mail } from 'lucide-react';
import Link from 'next/link';
import { useCopilotPageContext } from '@/components/copilot/CopilotNavigator';

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
          <Card key={i} className="border-border">
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
          <Card key={i} className="border-border">
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
      <Card className="border-border">
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

  useCopilotPageContext({ page: 'analytics' });

  const fetchOverview = useCallback(async (selectedRange: Range) => {
    setLoading(true);
    setError(null);
    try {
      const json = await analyticsApi.getOverview(selectedRange);
      setData(json as OverviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFunnels = useCallback(async () => {
    try {
      const json = await funnelApi.getAllFunnels();
      setFunnels((json.funnels || []) as FunnelItem[]);
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
      <div className="flex w-fit items-center gap-0.5 rounded-lg bg-muted p-1">
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={range === option.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleRangeChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
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
            <Card className="border-border">
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

            <Card className="border-border">
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
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Traffic Sources (UTM)</CardTitle>
            </CardHeader>
            <CardContent>
              <UTMBreakdown data={data.utmBreakdown} />
            </CardContent>
          </Card>

          {/* Content Pipeline */}
          {data.contentStats && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold">Content Pipeline</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Published Posts"
                  value={data.contentStats.posts.published}
                  description={`${data.contentStats.posts.total} total`}
                />
                <StatCard
                  label="Draft / Review Posts"
                  value={data.contentStats.posts.draft + data.contentStats.posts.review}
                  description={`${data.contentStats.posts.scheduled} scheduled`}
                />
                <StatCard
                  label="Knowledge Entries"
                  value={data.contentStats.knowledgeEntries}
                  description={`${data.contentStats.transcripts} transcript${data.contentStats.transcripts !== 1 ? 's' : ''}`}
                />
              </div>
            </div>
          )}

          {/* Sub-page links */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <Link
                href="/analytics/engagement"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                View engagement metrics →
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Link
                href="/analytics/email"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                View email analytics →
              </Link>
            </div>
          </div>

          {/* Funnel list */}
          {funnels.length > 0 && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Your Funnels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {funnels.map((funnel) => (
                    <Link
                      key={funnel.id}
                      href={`/analytics/funnel/${funnel.id}`}
                      className="flex items-center justify-between py-3 transition-opacity first:pt-0 last:pb-0 hover:opacity-80"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{getFunnelName(funnel)}</p>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            /{funnel.slug}
                            {!funnel.is_published && <Badge variant="orange">Draft</Badge>}
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
        <EmptyState
          icon={<BarChart3 />}
          title="No analytics data yet"
          description="Once visitors view your funnel pages and submit leads, your metrics will appear here."
        />
      )}
    </div>
  );
}
