'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ArrowUpDown, Eye, Users, Globe, Calendar, BookOpen, ExternalLink, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageListItem {
  id: string;
  slug: string;
  headline: string;
  isPublished: boolean;
  createdAt: string;
  targetType: 'lead_magnet' | 'library' | 'external_resource';
  connectedName: string;
  connectedIcon: string | null;
  connectedId: string | null;
  editLink: string;
  viewUrl: string | null;
  views: number;
  leads: number;
  conversionRate: number;
}

type SortOption = 'newest' | 'oldest' | 'most-leads' | 'most-views' | 'best-conversion' | 'a-z';
type StatusFilter = 'all' | 'published' | 'draft';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most-leads', label: 'Most Leads' },
  { value: 'most-views', label: 'Most Views' },
  { value: 'best-conversion', label: 'Best Conversion' },
  { value: 'a-z', label: 'A-Z' },
];

function sortItems(items: PageListItem[], sort: SortOption): PageListItem[] {
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
        return b.conversionRate - a.conversionRate;
      case 'a-z':
        return a.headline.localeCompare(b.headline);
    }
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ConnectedToIcon({ targetType }: { targetType: PageListItem['targetType'] }) {
  switch (targetType) {
    case 'library':
      return <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    case 'external_resource':
      return <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    default:
      return <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
}

export default function PagesListClient({ items }: { items: PageListItem[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    let result = items;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.headline.toLowerCase().includes(q) ||
          item.connectedName.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'published') {
      result = result.filter((item) => item.isPublished);
    } else if (statusFilter === 'draft') {
      result = result.filter((item) => !item.isPublished);
    }

    return sortItems(result, sort);
  }, [items, search, sort, statusFilter]);

  const publishedCount = items.filter((i) => i.isPublished).length;
  const draftCount = items.filter((i) => !i.isPublished).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
            {([
              { value: 'all' as StatusFilter, label: 'All', count: items.length },
              { value: 'published' as StatusFilter, label: 'Published', count: publishedCount },
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
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">Connected To</th>
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
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={item.editLink}
                        className="font-medium text-foreground group-hover:text-primary"
                      >
                        {item.headline}
                      </Link>
                      {item.viewUrl && (
                        <a
                          href={item.viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground/50 hover:text-primary transition-colors"
                          title="View live page"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">/{item.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      {item.connectedIcon ? (
                        <span className="shrink-0">{item.connectedIcon}</span>
                      ) : (
                        <ConnectedToIcon targetType={item.targetType} />
                      )}
                      {item.targetType === 'lead_magnet' && item.connectedId ? (
                        <Link
                          href={`/magnets/${item.connectedId}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {item.connectedName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{item.connectedName}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        item.isPublished
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      )}
                    >
                      {item.isPublished && <Globe className="h-3 w-3" />}
                      {item.isPublished ? 'Published' : 'Draft'}
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
                    {item.views > 0 ? (
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
              No pages match your search.
            </div>
          )}
        </div>
      </div>

      {/* Mobile compact cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {filtered.map((item) => (
          <Link
            key={item.id}
            href={item.editLink}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.headline}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.connectedIcon && <span className="mr-1">{item.connectedIcon}</span>}
                {item.connectedName}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    item.isPublished
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  )}
                >
                  {item.isPublished && <Globe className="h-3 w-3" />}
                  {item.isPublished ? 'Published' : 'Draft'}
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
            {item.views > 0 && (
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
            No pages match your search.
          </div>
        )}
      </div>
    </div>
  );
}
