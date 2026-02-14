'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/analytics/StatCards';
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart';
import { ArrowLeft } from 'lucide-react';

type Range = '7d' | '30d' | '90d';

interface FunnelData {
  funnel: { id: string; title: string; slug: string };
  viewsByDay: Array<{ date: string; views: number }>;
  leadsByDay: Array<{ date: string; leads: number }>;
  leads: Array<{
    id: string;
    email: string;
    name: string | null;
    isQualified: boolean | null;
    utmSource: string | null;
    createdAt: string;
  }>;
  totals: {
    views: number;
    leads: number;
    qualified: number;
    conversionRate: number;
    qualificationRate: number;
  };
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function QualifiedBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Yes
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        No
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      Pending
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <Skeleton className="h-8 w-64" />
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
      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface FunnelDetailProps {
  funnelId: string;
}

export function FunnelDetail({ funnelId }: FunnelDetailProps) {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (selectedRange: Range) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/analytics/funnel/${funnelId}?range=${selectedRange}`
        );
        if (response.status === 403) {
          throw new Error('You do not have access to this funnel.');
        }
        if (response.status === 404) {
          throw new Error('Funnel not found.');
        }
        if (!response.ok) {
          throw new Error('Failed to fetch funnel analytics.');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load funnel analytics'
        );
      } finally {
        setLoading(false);
      }
    },
    [funnelId]
  );

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  // Sort leads by date descending
  const sortedLeads = data
    ? [...data.leads].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

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

      {/* Header with title and range selector */}
      {!loading && data && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{data.funnel.title || data.funnel.slug}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              /{data.funnel.slug}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
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
        </div>
      )}

      {/* Show range selector while loading (for subsequent loads) */}
      {loading && data && (
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setRange(option.value)}
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
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
          <Link
            href="/analytics"
            className="mt-3 inline-block text-sm text-red-600 underline hover:text-red-500 dark:text-red-400"
          >
            Return to Analytics
          </Link>
        </div>
      )}

      {/* Loading state */}
      {loading && !data ? (
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

          {/* Lead table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Leads ({sortedLeads.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedLeads.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No leads captured in this time period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Qualified</th>
                        <th className="pb-3 font-medium">UTM Source</th>
                        <th className="pb-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-3">
                            {lead.name || (
                              <span className="text-muted-foreground">
                                &mdash;
                              </span>
                            )}
                          </td>
                          <td className="py-3">{lead.email}</td>
                          <td className="py-3">
                            <QualifiedBadge value={lead.isQualified} />
                          </td>
                          <td className="py-3">
                            {lead.utmSource || (
                              <span className="text-muted-foreground">
                                &mdash;
                              </span>
                            )}
                          </td>
                          <td className="py-3 whitespace-nowrap">
                            {formatDate(lead.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
