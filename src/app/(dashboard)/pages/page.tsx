'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, Edit, Plus, Loader2, Eye, EyeOff, Users, Upload, Trash2, BookOpen } from 'lucide-react';

interface FunnelPage {
  id: string;
  slug: string;
  optin_headline: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  target_type: string;
  lead_magnet_id: string | null;
  library_id: string | null;
  external_resource_id: string | null;
  lead_magnets?: {
    title: string;
  };
  libraries?: {
    name: string;
    icon: string;
  };
  external_resources?: {
    title: string;
    icon: string;
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

interface LibrarySummary {
  id: string;
  name: string;
  icon: string;
  slug: string;
  itemCount: number;
  hasFunnel: boolean;
}

interface ExternalResourceSummary {
  id: string;
  title: string;
  url: string;
  icon: string;
  clickCount: number;
}

type TabType = 'pages' | 'libraries' | 'resources';

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

function getEditLink(page: FunnelPage): string {
  if (page.target_type === 'library' && page.library_id) {
    return `/assets/libraries/${page.library_id}`;
  }
  if (page.lead_magnet_id) {
    return `/magnets/${page.lead_magnet_id}?tab=funnel`;
  }
  return '#';
}

function getTargetLabel(page: FunnelPage): string {
  if (page.target_type === 'library' && page.libraries) {
    return `${page.libraries.icon} ${page.libraries.name}`;
  }
  if (page.target_type === 'external_resource' && page.external_resources) {
    return `${page.external_resources.icon} ${page.external_resources.title}`;
  }
  return page.lead_magnets?.title || 'Lead Magnet';
}

export default function PagesPage() {
  const [pages, setPages] = useState<FunnelPage[]>([]);
  const [libraries, setLibraries] = useState<LibrarySummary[]>([]);
  const [resources, setResources] = useState<ExternalResourceSummary[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<FunnelStats>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  const [deletingResource, setDeletingResource] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [pagesRes, userRes, statsRes, librariesRes, resourcesRes] = await Promise.all([
          fetch('/api/funnel/all'),
          fetch('/api/user/username'),
          fetch('/api/funnel/stats'),
          fetch('/api/libraries'),
          fetch('/api/external-resources'),
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
        if (librariesRes.ok) {
          const data = await librariesRes.json();
          setLibraries((data.libraries || []).map((lib: { id: string; name: string; icon: string; slug: string }) => ({
            ...lib,
            itemCount: 0,
            hasFunnel: false,
          })));
        }
        if (resourcesRes.ok) {
          const data = await resourcesRes.json();
          setResources(data.resources || []);
        }
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleDeleteResource(id: string) {
    setDeletingResource(id);
    try {
      const res = await fetch(`/api/external-resources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setResources(resources.filter(r => r.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setDeletingResource(null);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'pages', label: 'Funnel Pages', count: pages.length },
    { id: 'libraries', label: 'Libraries', count: libraries.length },
    { id: 'resources', label: 'External Resources', count: resources.length },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pages & Assets</h1>
          <p className="text-muted-foreground">
            Manage your funnel pages, libraries, and external resources
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'pages' && (
            <>
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
            </>
          )}
          {activeTab === 'libraries' && (
            <Link
              href="/assets/libraries/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Library
            </Link>
          )}
          {activeTab === 'resources' && (
            <Link
              href="/assets/external/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Resource
            </Link>
          )}
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

      {/* Tabs */}
      <div className="mb-6 flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Funnel Pages Tab */}
      {activeTab === 'pages' && (
        <>
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
                        {page.target_type === 'library' ? (
                          <BookOpen className="h-5 w-5 text-primary" />
                        ) : (
                          <Globe className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">{page.optin_headline}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getTargetLabel(page)} · /{page.slug}
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
                        href={getEditLink(page)}
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
        </>
      )}

      {/* Libraries Tab */}
      {activeTab === 'libraries' && (
        <>
          {libraries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <span className="mx-auto block text-5xl mb-4">📚</span>
              <h3 className="text-lg font-medium">No libraries yet</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Libraries let you group multiple lead magnets and external resources into a single shareable page.
              </p>
              <Link
                href="/assets/libraries/new"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create Library
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {libraries.map((lib) => (
                <div
                  key={lib.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xl">
                      {lib.icon}
                    </div>
                    <div>
                      <h3 className="font-medium">{lib.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        /{lib.slug}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/assets/libraries/${lib.id}`}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Edit className="h-4 w-4" />
                      Manage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* External Resources Tab */}
      {activeTab === 'resources' && (
        <>
          {resources.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <span className="mx-auto block text-5xl mb-4">🔗</span>
              <h3 className="text-lg font-medium">No external resources yet</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Add links to external content like YouTube videos, tools, or guides. Track clicks when used in libraries.
              </p>
              <Link
                href="/assets/external/new"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Resource
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xl">
                      {resource.icon}
                    </div>
                    <div>
                      <h3 className="font-medium">{resource.title}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-xs">
                        {resource.url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {resource.clickCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {resource.clickCount} clicks
                      </span>
                    )}
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteResource(resource.id)}
                      disabled={deletingResource === resource.id}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50"
                    >
                      {deletingResource === resource.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
