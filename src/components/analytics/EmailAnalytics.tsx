'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Mail, CheckCircle, Eye, MousePointer, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

type Range = '7d' | '30d' | '90d';

interface EmailAnalyticsData {
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  byMagnet: Array<{
    leadMagnetId: string;
    title: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Rate cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Volume cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-2 h-7 w-12" />
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
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RateCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'good' | 'bad' | 'neutral';
}) {
  const colorClasses = {
    good: 'text-green-600 dark:text-green-400',
    bad: 'text-red-600 dark:text-red-400',
    neutral: 'text-foreground',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${colorClasses[variant]}`}>
          {value}%
        </p>
      </CardContent>
    </Card>
  );
}

export function EmailAnalytics() {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<EmailAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (selectedRange: Range) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analytics/email?range=${selectedRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch email analytics');
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  const hasData = data && data.totals.sent > 0;

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

      {/* Date range selector */}
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          {hasData ? (
            <>
              {/* Rate cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <RateCard
                  label="Delivery Rate"
                  value={data.rates.deliveryRate}
                  variant={data.rates.deliveryRate >= 95 ? 'good' : data.rates.deliveryRate >= 85 ? 'neutral' : 'bad'}
                />
                <RateCard
                  label="Open Rate"
                  value={data.rates.openRate}
                  variant={data.rates.openRate >= 30 ? 'good' : data.rates.openRate >= 15 ? 'neutral' : 'bad'}
                />
                <RateCard
                  label="Click Rate"
                  value={data.rates.clickRate}
                  variant={data.rates.clickRate >= 5 ? 'good' : data.rates.clickRate >= 2 ? 'neutral' : 'bad'}
                />
                <RateCard
                  label="Bounce Rate"
                  value={data.rates.bounceRate}
                  variant={data.rates.bounceRate <= 2 ? 'good' : data.rates.bounceRate <= 5 ? 'neutral' : 'bad'}
                />
              </div>

              {/* Volume cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-950">
                        <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sent</p>
                        <p className="text-2xl font-bold tabular-nums">{data.totals.sent}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-950">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Delivered</p>
                        <p className="text-2xl font-bold tabular-nums">{data.totals.delivered}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-950">
                        <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Opened</p>
                        <p className="text-2xl font-bold tabular-nums">{data.totals.opened}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-950">
                        <MousePointer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Clicked</p>
                        <p className="text-2xl font-bold tabular-nums">{data.totals.clicked}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-red-100 p-2.5 dark:bg-red-950">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Bounced</p>
                        <p className="text-2xl font-bold tabular-nums">{data.totals.bounced}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Per-magnet table */}
              {data.byMagnet.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Email Performance by Lead Magnet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 pr-4 font-medium text-muted-foreground">
                              Lead Magnet
                            </th>
                            <th className="pb-3 pr-4 text-right font-medium text-muted-foreground">
                              Sent
                            </th>
                            <th className="pb-3 pr-4 text-right font-medium text-muted-foreground">
                              Opened
                            </th>
                            <th className="pb-3 text-right font-medium text-muted-foreground">
                              Clicked
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byMagnet.map((magnet) => (
                            <tr
                              key={magnet.leadMagnetId}
                              className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                            >
                              <td className="py-3 pr-4 font-medium line-clamp-1">
                                {magnet.title}
                              </td>
                              <td className="py-3 pr-4 text-right tabular-nums">
                                {magnet.sent}
                              </td>
                              <td className="py-3 pr-4 text-right tabular-nums">
                                {magnet.opened}
                              </td>
                              <td className="py-3 text-right tabular-nums">
                                {magnet.clicked}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No email events tracked yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Set up Resend webhooks to start tracking delivery, opens, clicks, and bounces.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
