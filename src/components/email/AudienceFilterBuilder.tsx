'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Loader2 } from 'lucide-react';
import type { AudienceFilter } from '@/lib/types/email-system';

interface AudienceFilterBuilderProps {
  filter: AudienceFilter | null;
  onChange: (filter: AudienceFilter | null) => void;
  broadcastId: string;
}

const ENGAGEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All subscribers' },
  { value: 'opened_30d', label: 'Opened in last 30 days' },
  { value: 'opened_60d', label: 'Opened in last 60 days' },
  { value: 'opened_90d', label: 'Opened in last 90 days' },
  { value: 'clicked_30d', label: 'Clicked in last 30 days' },
  { value: 'clicked_60d', label: 'Clicked in last 60 days' },
  { value: 'clicked_90d', label: 'Clicked in last 90 days' },
  { value: 'never_opened', label: 'Never opened' },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All sources' },
  { value: 'lead_magnet', label: 'Lead Magnet' },
  { value: 'manual', label: 'Manual' },
  { value: 'import', label: 'Import' },
];

export function AudienceFilterBuilder({
  filter,
  onChange,
  broadcastId,
}: AudienceFilterBuilderProps) {
  const [count, setCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const engagement = filter?.engagement || '';
  const source = filter?.source || '';

  const fetchPreviewCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const response = await fetch(`/api/email/broadcasts/${broadcastId}/preview-count`);
      if (!response.ok) throw new Error('Failed to get count');
      const data = await response.json();
      setCount(data.count);
      setTotal(data.total);
    } catch {
      // Silently fail — count is informational
    } finally {
      setLoadingCount(false);
    }
  }, [broadcastId]);

  // Fetch count on mount and when filter changes (debounced)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchPreviewCount();
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [fetchPreviewCount]);

  const handleEngagementChange = (value: string) => {
    const newFilter: AudienceFilter = { ...filter };
    if (value) {
      newFilter.engagement = value as AudienceFilter['engagement'];
    } else {
      delete newFilter.engagement;
    }

    // If all filters cleared, set to null
    const hasAnyFilter = newFilter.engagement || newFilter.source;
    onChange(hasAnyFilter ? newFilter : null);
  };

  const handleSourceChange = (value: string) => {
    const newFilter: AudienceFilter = { ...filter };
    if (value) {
      newFilter.source = value;
    } else {
      delete newFilter.source;
    }

    // If all filters cleared, set to null
    const hasAnyFilter = newFilter.engagement || newFilter.source;
    onChange(hasAnyFilter ? newFilter : null);
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Audience</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Engagement
            </label>
            <select
              value={engagement}
              onChange={(e) => handleEngagementChange(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ENGAGEMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Source
            </label>
            <select
              value={source}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live count */}
        <div className="flex items-center gap-2 pt-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          {loadingCount ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Counting...
            </span>
          ) : count !== null && total !== null ? (
            <span className="text-sm">
              Matching <span className="font-bold">{count}</span>{' '}
              <span className="text-muted-foreground">of {total} subscribers</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">--</span>
          )}
        </div>
      </div>
    </div>
  );
}
