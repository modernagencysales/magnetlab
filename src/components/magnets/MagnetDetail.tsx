'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  ExternalLink,
  Calendar,
  Sparkles,
  FileText,
  Users,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FunnelBuilder } from '@/components/funnel';
import type { LeadMagnet } from '@/lib/types/lead-magnet';
import type { FunnelPage, QualificationQuestion } from '@/lib/types/funnel';
import { ScreenshotGallery } from './ScreenshotGallery';

type Tab = 'overview' | 'funnel' | 'post' | 'leads' | 'analytics';

const TABS: { id: Tab; label: string; icon: typeof Globe }[] = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'funnel', label: 'Funnel', icon: Globe },
  { id: 'post', label: 'Post', icon: FileText },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

interface MagnetDetailProps {
  leadMagnet: LeadMagnet;
  existingFunnel: FunnelPage | null;
  existingQuestions: QualificationQuestion[];
  username: string | null;
  archetypeName: string;
  connectedEmailProviders?: string[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function MagnetDetail({
  leadMagnet,
  existingFunnel,
  existingQuestions,
  username,
  archetypeName,
  connectedEmailProviders = [],
}: MagnetDetailProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'overview');

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/magnets"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Lead Magnets
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          {archetypeName}
        </div>
        <h1 className="text-3xl font-bold">{leadMagnet.title}</h1>
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Created {formatDate(leadMagnet.createdAt)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              leadMagnet.status === 'published'
                ? 'bg-green-500/10 text-green-600'
                : leadMagnet.status === 'scheduled'
                ? 'bg-blue-500/10 text-blue-600'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {leadMagnet.status}
          </span>
          {existingFunnel?.isPublished && username && (
            <a
              href={`/p/${username}/${existingFunnel.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View live page
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          leadMagnet={leadMagnet}
          existingFunnel={existingFunnel}
          username={username}
          onTabChange={handleTabChange}
        />
      )}
      {activeTab === 'funnel' && (
        <FunnelBuilder
          leadMagnet={leadMagnet}
          existingFunnel={existingFunnel}
          existingQuestions={existingQuestions}
          username={username}
          connectedEmailProviders={connectedEmailProviders}
        />
      )}
      {activeTab === 'post' && (
        <PostTab
          leadMagnet={leadMagnet}
          hasPublishedFunnel={!!existingFunnel?.isPublished}
        />
      )}
      {activeTab === 'leads' && <LeadsTab funnelId={existingFunnel?.id || null} />}
      {activeTab === 'analytics' && <AnalyticsTab magnetId={leadMagnet.id} />}
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────

function OverviewTab({
  leadMagnet,
  existingFunnel,
  username,
  onTabChange,
}: {
  leadMagnet: LeadMagnet;
  existingFunnel: FunnelPage | null;
  username: string | null;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Funnel Card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Globe className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold">Funnel Page</h3>
            <p className="text-sm text-muted-foreground">
              {existingFunnel ? 'Edit your opt-in page' : 'Create an opt-in page'}
            </p>
          </div>
        </div>
        {existingFunnel ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  existingFunnel.isPublished
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {existingFunnel.isPublished ? 'Published' : 'Draft'}
              </span>
              <span className="text-sm text-muted-foreground">/{existingFunnel.slug}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onTabChange('funnel')}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Edit Funnel
              </button>
              {existingFunnel.isPublished && username && (
                <a
                  href={`/p/${username}/${existingFunnel.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  <ExternalLink className="h-4 w-4" />
                  View
                </a>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => onTabChange('funnel')}
            className="block w-full rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Funnel Page
          </button>
        )}
      </div>

      {/* Concept */}
      {leadMagnet.concept && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Lead Magnet Concept
          </h3>
          <div className="space-y-4 text-sm">
            {leadMagnet.concept.painSolved && (
              <div>
                <span className="font-medium text-muted-foreground">Pain Solved:</span>
                <p className="mt-1">{leadMagnet.concept.painSolved}</p>
              </div>
            )}
            {leadMagnet.concept.whyNowHook && (
              <div>
                <span className="font-medium text-muted-foreground">Why Now Hook:</span>
                <p className="mt-1">{leadMagnet.concept.whyNowHook}</p>
              </div>
            )}
            {leadMagnet.concept.deliveryFormat && (
              <div>
                <span className="font-medium text-muted-foreground">Format:</span>
                <p className="mt-1">{leadMagnet.concept.deliveryFormat}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DM Template */}
      {leadMagnet.dmTemplate && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-3">DM Template</h3>
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-secondary/50 rounded-lg p-4">
            {leadMagnet.dmTemplate}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Post Tab ───────────────────────────────────────────────

function PostTab({
  leadMagnet,
  hasPublishedFunnel,
}: {
  leadMagnet: LeadMagnet;
  hasPublishedFunnel: boolean;
}) {
  const variations = leadMagnet.postVariations || [];
  const mainPost = leadMagnet.linkedinPost;

  return (
    <div className="space-y-6">
      {/* Screenshot Gallery */}
      <div className="rounded-xl border bg-card p-6">
        <ScreenshotGallery
          screenshotUrls={leadMagnet.screenshotUrls || []}
          leadMagnetId={leadMagnet.id}
          hasPublishedFunnel={hasPublishedFunnel}
        />
      </div>

      {mainPost && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-3">LinkedIn Post</h3>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {mainPost}
          </pre>
        </div>
      )}

      {variations.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Post Variations</h3>
          {variations.map((variation, i: number) => (
            <div key={i} className="rounded-xl border bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Variation {i + 1}
                </span>
                {variation.hookType && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {variation.hookType}
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                {variation.post}
              </pre>
            </div>
          ))}
        </div>
      )}

      {!mainPost && variations.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No posts yet</h3>
          <p className="text-muted-foreground">
            Complete the lead magnet wizard to generate LinkedIn posts.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Leads Tab ──────────────────────────────────────────────

function LeadsTab({ funnelId }: { funnelId: string | null }) {
  const [leads, setLeads] = useState<Array<{ id: string; name: string; email: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!funnelId) {
      setLoading(false);
      return;
    }
    fetch(`/api/leads?funnelId=${funnelId}`)
      .then((r) => r.ok ? r.json() : { leads: [] })
      .then((data) => setLeads(data.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [funnelId]);

  if (!funnelId) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No funnel page yet</h3>
        <p className="text-muted-foreground">
          Create a funnel page first to start capturing leads.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No leads yet</h3>
        <p className="text-muted-foreground">
          Share your funnel page to start capturing leads.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-secondary/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b last:border-0">
              <td className="px-4 py-3">{lead.name || '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{lead.email}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(lead.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────

function AnalyticsTab({ magnetId }: { magnetId: string }) {
  return (
    <div className="rounded-xl border bg-card p-12 text-center" data-magnet-id={magnetId}>
      <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">Per-magnet analytics</h3>
      <p className="text-muted-foreground">
        Detailed analytics for this lead magnet coming soon.
      </p>
    </div>
  );
}
