'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, Edit, Plus, Loader2, Upload, Trash2 } from 'lucide-react';
import {
  PageContainer,
  PageTitle,
  Button,
  EmptyState,
  Card,
  CardContent,
  Badge,
  Skeleton,
} from '@magnetlab/magnetui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@magnetlab/magnetui';
import PagesListClient from '@/components/pages/PagesListClient';
import type { PageListItem } from '@/components/pages/PagesListClient';
import * as funnelApi from '@/frontend/api/funnel';
import * as userApi from '@/frontend/api/user';
import * as librariesApi from '@/frontend/api/libraries';
import * as externalResourcesApi from '@/frontend/api/external-resources';

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
  users?: {
    username: string | null;
  };
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
    views: number;
    conversionRate: number;
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

function getEditLink(page: FunnelPage): string {
  if (page.target_type === 'library' && page.library_id) {
    return `/assets/libraries/${page.library_id}`;
  }
  if (page.target_type === 'external_resource' && page.external_resource_id) {
    return `/assets/external/${page.external_resource_id}/funnel`;
  }
  if (page.lead_magnet_id) {
    return `/magnets/${page.lead_magnet_id}?tab=funnel`;
  }
  return '#';
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
        const [pagesData, userData, statsData, librariesData, resourcesData] = await Promise.all([
          funnelApi.getAllFunnels().catch(() => ({ funnels: [] })),
          userApi.getUsername().catch(() => ({ username: null })),
          funnelApi.getFunnelStats().catch(() => ({ stats: {} })),
          librariesApi.listLibraries().catch(() => ({ libraries: [] })),
          externalResourcesApi.listExternalResources().catch(() => ({ resources: [] })),
        ]);

        setPages((pagesData.funnels || []) as FunnelPage[]);
        setUser(userData as User);
        setStats(
          statsData.stats && typeof statsData.stats === 'object'
            ? (statsData.stats as FunnelStats)
            : {}
        );
        setLibraries(
          (librariesData.libraries || []).map((lib: unknown) => {
            const l = lib as { id: string; name: string; icon: string; slug: string };
            return { ...l, itemCount: 0, hasFunnel: false };
          })
        );
        setResources((resourcesData.resources || []) as typeof resources);
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
      await externalResourcesApi.deleteExternalResource(id);
      setResources(resources.filter((r) => r.id !== id));
    } catch {
      // ignore
    } finally {
      setDeletingResource(null);
    }
  }

  const pageListItems: PageListItem[] = useMemo(() => {
    return pages.map((page) => {
      const pageStats = stats[page.id];
      const username = page.users?.username || user?.username || null;

      let connectedName = page.lead_magnets?.title || 'Lead Magnet';
      let connectedIcon: string | null = null;
      let connectedId: string | null = page.lead_magnet_id;
      let targetType: PageListItem['targetType'] = 'lead_magnet';

      if (page.target_type === 'library' && page.libraries) {
        targetType = 'library';
        connectedName = page.libraries.name;
        connectedIcon = page.libraries.icon;
        connectedId = page.library_id;
      } else if (page.target_type === 'external_resource' && page.external_resources) {
        targetType = 'external_resource';
        connectedName = page.external_resources.title;
        connectedIcon = page.external_resources.icon;
        connectedId = page.external_resource_id;
      }

      return {
        id: page.id,
        slug: page.slug,
        headline: page.optin_headline,
        isPublished: page.is_published,
        createdAt: page.created_at,
        targetType,
        connectedName,
        connectedIcon,
        connectedId,
        editLink: getEditLink(page),
        viewUrl: page.is_published && username ? `/p/${username}/${page.slug}` : null,
        views: pageStats?.views ?? 0,
        leads: pageStats?.total ?? 0,
        conversionRate: pageStats?.conversionRate ?? 0,
      };
    });
  }, [pages, stats, user]);

  if (loading) {
    return (
      <PageContainer maxWidth="xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  const tabActions: Record<TabType, React.ReactNode> = {
    pages: (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/pages/import">
            <Upload className="mr-1 h-4 w-4" />
            Import
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/pages/new">
            <Plus className="mr-1 h-4 w-4" />
            Create Page
          </Link>
        </Button>
      </div>
    ),
    libraries: (
      <Button size="sm" asChild>
        <Link href="/assets/libraries/new">
          <Plus className="h-4 w-4 mr-1" />
          New Library
        </Link>
      </Button>
    ),
    resources: (
      <Button size="sm" asChild>
        <Link href="/assets/external/new">
          <Plus className="h-4 w-4 mr-1" />
          Add Resource
        </Link>
      </Button>
    ),
  };

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <PageTitle
          title="Pages & Assets"
          description="Manage your funnel pages, libraries, and external resources"
          actions={tabActions[activeTab]}
        />

        {!user?.username && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Set a username</strong> to enable public page URLs.{' '}
              <Link href="/settings" className="underline hover:no-underline">
                Go to Settings
              </Link>
            </p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList variant="pill" className="mb-6">
            <TabsTrigger value="pages" variant="pill">
              Funnel Pages
              {pages.length > 0 && (
                <Badge variant="count" className="ml-1.5">
                  {pages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="libraries" variant="pill">
              Libraries
              {libraries.length > 0 && (
                <Badge variant="count" className="ml-1.5">
                  {libraries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resources" variant="pill">
              External Resources
              {resources.length > 0 && (
                <Badge variant="count" className="ml-1.5">
                  {resources.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pages" className="mt-0">
            {pages.length === 0 ? (
              <EmptyState
                icon={<Globe />}
                title="No pages yet"
                description="Create a capture page to start collecting leads."
                action={
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/pages/import">
                        <Upload className="mr-1 h-4 w-4" />
                        Import
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href="/pages/new">
                        <Plus className="mr-1 h-4 w-4" />
                        Create Page
                      </Link>
                    </Button>
                  </div>
                }
              />
            ) : (
              <PagesListClient items={pageListItems} />
            )}
          </TabsContent>

          <TabsContent value="libraries" className="mt-0">
            {libraries.length === 0 ? (
              <EmptyState
                icon={<span className="text-2xl">📚</span>}
                title="No libraries yet"
                description="Libraries let you group multiple lead magnets and external resources into a single shareable page."
                action={
                  <Button size="sm" asChild>
                    <Link href="/assets/libraries/new">
                      <Plus className="mr-1 h-4 w-4" />
                      Create Library
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4">
                {libraries.map((lib) => (
                  <Card key={lib.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-lg">
                          {lib.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{lib.name}</p>
                          <p className="text-xs text-muted-foreground">/{lib.slug}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/assets/libraries/${lib.id}`}>
                          <Edit className="mr-1 h-3.5 w-3.5" />
                          Manage
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resources" className="mt-0">
            {resources.length === 0 ? (
              <EmptyState
                icon={<span className="text-2xl">🔗</span>}
                title="No external resources yet"
                description="Add links to external content like YouTube videos, tools, or guides. Track clicks when used in libraries."
                action={
                  <Button size="sm" asChild>
                    <Link href="/assets/external/new">
                      <Plus className="mr-1 h-4 w-4" />
                      Add Resource
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4">
                {resources.map((resource) => (
                  <Card key={resource.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-lg">
                          {resource.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{resource.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {resource.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {resource.clickCount > 0 && (
                          <span className="mr-2 text-xs text-muted-foreground">
                            {resource.clickCount} clicks
                          </span>
                        )}
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a href={resource.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteResource(resource.id)}
                          disabled={deletingResource === resource.id}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {deletingResource === resource.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
