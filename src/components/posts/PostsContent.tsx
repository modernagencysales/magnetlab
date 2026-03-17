'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Lightbulb, LayoutGrid, Sparkles, Loader2, BookOpen, Calendar, Zap } from 'lucide-react';
import { PageContainer, PageTitle, Button, StatusDot } from '@magnetlab/magnetui';

import {
  ProfileSwitcher,
  useProfileSelection,
} from '@/components/content-pipeline/ProfileSwitcher';
import type { ContentIdea, PipelinePost } from '@/lib/types/content-pipeline';

const IdeasTab = dynamic(
  () => import('@/components/content-pipeline/IdeasTab').then((m) => ({ default: m.IdeasTab })),
  { ssr: false }
);
const AutopilotTab = dynamic(
  () =>
    import('@/components/content-pipeline/AutopilotTab').then((m) => ({ default: m.AutopilotTab })),
  { ssr: false }
);
const PipelineView = dynamic(
  () =>
    import('@/components/content-pipeline/PipelineView').then((m) => ({ default: m.PipelineView })),
  { ssr: false }
);
const CalendarView = dynamic(
  () =>
    import('@/components/content-pipeline/CalendarView').then((m) => ({ default: m.CalendarView })),
  { ssr: false }
);
const LibraryTab = dynamic(
  () => import('@/components/content-pipeline/LibraryTab').then((m) => ({ default: m.LibraryTab })),
  { ssr: false }
);
const QuickWriteModal = dynamic(
  () =>
    import('@/components/content-pipeline/QuickWriteModal').then((m) => ({
      default: m.QuickWriteModal,
    })),
  { ssr: false }
);

type Tab = 'pipeline' | 'calendar' | 'ideas' | 'library' | 'autopilot';

const TABS: { id: Tab; label: string; icon: typeof Lightbulb }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'autopilot', label: 'Autopilot', icon: Sparkles },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

interface PostsContentProps {
  initialBufferLow: boolean;
  initialIdeas: ContentIdea[];
  initialPosts: PipelinePost[];
}

export function PostsContent({ initialBufferLow, initialIdeas, initialPosts }: PostsContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'pipeline'
  );
  const [showQuickWrite, setShowQuickWrite] = useState(false);
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
      // silent
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
          title="Posts"
          description="Manage your content ideas, drafts, and publishing schedule"
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
          {activeTab === 'ideas' && <IdeasTab profileId={selectedProfileId} />}
          {activeTab === 'library' && <LibraryTab />}
          {activeTab === 'autopilot' && <AutopilotTab profileId={selectedProfileId} />}
        </Suspense>

        {/* Quick Write FAB */}
        <button
          onClick={() => setShowQuickWrite(true)}
          className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          title="Quick Write"
        >
          <Sparkles className="h-5 w-5" />
        </button>
        {showQuickWrite && (
          <QuickWriteModal
            onClose={() => setShowQuickWrite(false)}
            onPostCreated={() => {
              // Switch to pipeline tab and refresh it
              handleTabChange('pipeline');
              setRefreshKey((k) => k + 1);
            }}
            profileId={selectedProfileId}
          />
        )}
      </div>
    </PageContainer>
  );
}
