'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, Edit, Plus, Loader2, Eye, EyeOff, Users, Upload } from 'lucide-react';

interface FunnelPage {
  id: string;
  slug: string;
  optin_headline: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  lead_magnet_id: string;
  lead_magnets?: {
    title: string;
  };
}

interface User {
  username: string | null;
}

interface FunnelStats {
  [funnelId: string]: {
    total: number;
    qualified: number;
    unqualified: number;
  };
}

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  if (isPublished) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
        <Eye className="h-3 w-3" />
        Published
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <EyeOff className="h-3 w-3" />
      Draft
    </span>
  );
}

export default function PagesPage() {
  const [pages, setPages] = useState<FunnelPage[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<FunnelStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [pagesRes, userRes, statsRes] = await Promise.all([
          fetch('/api/funnel/all'),
          fetch('/api/user/username'),
          fetch('/api/funnel/stats'),
        ]);

        if (pagesRes.ok) {
          const data = await pagesRes.json();
          setPages(data.funnels || []);
        }
        if (userRes.ok) {
          const data = await userRes.json();
          setUser(data);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats || {});
        }
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pages</h1>
          <p className="text-muted-foreground">
            Manage your funnel and opt-in pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pages/import"
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import
          </Link>
          <Link
            href="/pages/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Page
          </Link>
        </div>
      </div>

      {!user?.username && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Set a username</strong> to enable public page URLs.{' '}
            <Link href="/settings" className="underline hover:no-underline">
              Go to Settings
            </Link>
          </p>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No pages yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Create a capture page to start collecting leads.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/pages/import"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import
            </Link>
            <Link
              href="/pages/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Page
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => {
            const pageStats = stats[page.id];
            const hasLeads = pageStats && pageStats.total > 0;

            return (
              <div
                key={page.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{page.optin_headline}</h3>
                    <p className="text-sm text-muted-foreground">
                      {page.lead_magnets?.title || 'Lead Magnet'} · /{page.slug}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasLeads && (
                    <Link
                      href={`/leads?funnelId=${page.id}`}
                      className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800"
                    >
                      <Users className="h-3 w-3" />
                      {pageStats.total} leads
                    </Link>
                  )}

                  <StatusBadge isPublished={page.is_published} />

                  <Link
                    href={`/magnets/${page.lead_magnet_id}?tab=funnel`}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Link>

                  {page.is_published && user?.username && (
                    <a
                      href={`/p/${user.username}/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
