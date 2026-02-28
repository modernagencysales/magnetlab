'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ArrowUpDown, Eye, Users, Globe, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';

export interface MagnetListItem {
  id: string;
  title: string;
  archetype: string;
  status: string;
  createdAt: string;
  isLive: boolean;
  hasFunnel: boolean;
  views: number;
  leads: number;
  conversionRate: number | null;
}

type SortOption = 'newest' | 'oldest' | 'most-leads' | 'most-views' | 'best-conversion' | 'a-z';
type StatusFilter = 'all' | 'live' | 'draft';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most-leads', label: 'Most Leads' },
  { value: 'most-views', label: 'Most Views' },
  { value: 'best-conversion', label: 'Best Conversion' },
  { value: 'a-z', label: 'A-Z' },
];

function sortItems(items: MagnetListItem[], sort: SortOption): MagnetListItem[] {
  return [...items].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'most-leads':
        return b.leads - a.leads;
      case 'most-views':
        return b.views - a.views;
      case 'best-conversion':
        return (b.conversionRate ?? -1) - (a.conversionRate ?? -1);
      case 'a-z':
        return a.title.localeCompare(b.title);
    }
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MagnetsListClient({
  items,
  totalCount,
}: {
  items: MagnetListItem[];
  totalCount: number;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    let result = items;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }

    if (statusFilter === 'live') {
      result = result.filter((item) => item.isLive);
    } else if (statusFilter === 'draft') {
      result = result.filter((item) => !item.isLive);
    }

    return sortItems(result, sort);
  }, [items, search, sort, statusFilter]);

  const liveCount = items.filter((i) => i.isLive).length;
  const draftCount = items.filter((i) => !i.isLive).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search lead magnets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
            {([
              { value: 'all' as StatusFilter, label: 'All', count: totalCount },
              { value: 'live' as StatusFilter, label: 'Live', count: liveCount },
              { value: 'draft' as StatusFilter, label: 'Draft', count: draftCount },
            ]).map((pill) => (
              <button
                key={pill.value}
                onClick={() => setStatusFilter(pill.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === pill.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {pill.label}
                <span className="ml-1 text-muted-foreground">({pill.count})</span>
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="h-9 appearance-none rounded-lg border bg-background pl-8 pr-8 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {search || statusFilter !== 'all' ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </p>
      ) : null}

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Views</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Conv.</th>
                <th className="px-4 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="group border-b last:border-0 transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/magnets/${item.id}`}
                      className="font-medium text-foreground group-hover:text-primary"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {ARCHETYPE_NAMES[item.archetype as keyof typeof ARCHETYPE_NAMES] || item.archetype}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        item.isLive
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      )}
                    >
                      {item.isLive && <Globe className="h-3 w-3" />}
                      {item.isLive ? 'Live' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {item.views > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {item.views.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {item.leads > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {item.leads.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {item.conversionRate !== null ? (
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-xs font-medium',
                          item.conversionRate >= 20
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : item.conversionRate >= 10
                            ? 'bg-yellow-500/10 text-yellow-600'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        )}
                      >
                        {item.conversionRate.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatShortDate(item.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No lead magnets match your search.
            </div>
          )}
        </div>
      </div>

      {/* Mobile compact cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {filtered.map((item) => (
          <Link
            key={item.id}
            href={`/magnets/${item.id}`}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    item.isLive
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  )}
                >
                  {item.isLive && <Globe className="h-3 w-3" />}
                  {item.isLive ? 'Live' : 'Draft'}
                </span>
                {item.leads > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {item.leads}
                  </span>
                )}
                {item.views > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {item.views}
                  </span>
                )}
              </div>
            </div>
            {item.conversionRate !== null && (
              <span
                className={cn(
                  'ml-3 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                  item.conversionRate >= 20
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : item.conversionRate >= 10
                    ? 'bg-yellow-500/10 text-yellow-600'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                )}
              >
                {item.conversionRate.toFixed(1)}%
              </span>
            )}
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No lead magnets match your search.
          </div>
        )}
      </div>
    </div>
  );
}
