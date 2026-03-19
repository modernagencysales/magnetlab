'use client';

/**
 * PipelineContent.
 * Client component for the /pipeline route.
 * Hosts Pipeline, Calendar, Autopilot, and Content Queue tabs.
 * Never imports from the server layer.
 */

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LayoutGrid, Calendar, Sparkles, Loader2, ListChecks, Zap } from 'lucide-react';
import { PageContainer, PageTitle, Button, StatusDot } from '@magnetlab/magnetui';

import {
  ProfileSwitcher,
  useProfileSelection,
} from '@/components/content-pipeline/ProfileSwitcher';
import type { ContentIdea, PipelinePost } from '@/lib/types/content-pipeline';

// ─── Dynamic Imports ─────────────────────────────────────────────────────────

const PipelineView = dynamic(
  () =>
    import('@/components/content-pipeline/PipelineView').then((m) => ({ default: m.PipelineView })),
  { ssr: false }
);
const CalendarView = dynamic(
  () =>
    import('@/components/content-pipeline/CalendarView').then((m) => ({
      default: m.CalendarView,
    })),
  { ssr: false }
);
const AutopilotTab = dynamic(
  () =>
    import('@/components/content-pipeline/AutopilotTab').then((m) => ({
      default: m.AutopilotTab,
    })),
  { ssr: false }
);
const ContentQueuePage = dynamic(
  () =>
    import('@/components/content-queue/ContentQueuePage').then((m) => ({
      default: m.ContentQueuePage,
    })),
  { ssr: false }
);

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'pipeline' | 'calendar' | 'autopilot' | 'content-queue';

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'autopilot', label: 'Autopilot', icon: Sparkles },
  { id: 'content-queue', label: 'Content Queue', icon: ListChecks },
];

interface PipelineContentProps {
  initialBufferLow: boolean;
  initialIdeas: ContentIdea[];
  initialPosts: PipelinePost[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PipelineContent({
  initialBufferLow,
  initialIdeas,
  initialPosts,
}: PipelineContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'pipeline'
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const { selectedProfileId, onProfileChange } = useProfileSelection();
  const bufferLow = initialBufferLow;

  const [showGeneratePopover, setShowGeneratePopover] = useState(false);
  const [batchSize, setBatchSize] = useState(3);
  const [generating, setGenerating] = useState(false);
  const generateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (generateRef.current && !generateRef.current.contains(e.target as Node)) {
        setShowGeneratePopover(false);
      }
    }
    if (showGeneratePopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showGeneratePopover]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await fetch('/api/content-pipeline/schedule/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postsPerBatch: batchSize,
          profileId: selectedProfileId || undefined,
        }),
      });
      setShowGeneratePopover(false);
      handleTabChange('pipeline');
      setTimeout(() => {
        router.refresh();
        setRefreshKey((k) => k + 1);
      }, 2000);
    } catch {
      // silent — autopilot generation is best-effort
    } finally {
      setGenerating(false);
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'pipeline') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
  }

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <PageTitle
          title="Pipeline"
          description="Manage your content pipeline, publishing schedule, autopilot, and editing queue"
          actions={
            <div className="flex items-center gap-3">
              <div className="relative" ref={generateRef}>
                <Button onClick={() => setShowGeneratePopover((v) => !v)}>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Generate Posts
                </Button>
                {showGeneratePopover && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-4 shadow-lg">
                    <label className="mb-2 block text-sm font-medium">Posts per batch</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={batchSize}
                      onChange={(e) =>
                        setBatchSize(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className="mb-3 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    />
                    <Button onClick={handleGenerate} disabled={generating} className="w-full">
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1.5" />
                      )}
                      {generating ? 'Generating...' : 'Generate'}
                    </Button>
                  </div>
                )}
              </div>
              <ProfileSwitcher
                selectedProfileId={selectedProfileId}
                onProfileChange={onProfileChange}
              />
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTabChange(tab.id)}
            >
              <tab.icon className="mr-1.5 h-3.5 w-3.5" />
              {tab.label}
              {tab.id === 'autopilot' && bufferLow && (
                <StatusDot status="warning" size="sm" pulse className="ml-1.5" />
              )}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        <Suspense fallback={<TabLoader />}>
          {activeTab === 'pipeline' && (
            <PipelineView
              key={refreshKey}
              profileId={selectedProfileId}
              onRefresh={() => {
                router.refresh();
                setRefreshKey((k) => k + 1);
              }}
              initialIdeas={initialIdeas}
              initialPosts={initialPosts}
            />
          )}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'autopilot' && <AutopilotTab profileId={selectedProfileId} />}
          {activeTab === 'content-queue' && <ContentQueuePage />}
        </Suspense>
      </div>
    </PageContainer>
  );
}
