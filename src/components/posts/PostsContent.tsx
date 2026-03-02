'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Lightbulb, LayoutGrid, Sparkles, Loader2, BookOpen, Calendar, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileSwitcher, useProfileSelection } from '@/components/content-pipeline/ProfileSwitcher';

const IdeasTab = dynamic(
  () => import('@/components/content-pipeline/IdeasTab').then((m) => ({ default: m.IdeasTab })),
  { ssr: false }
);
const AutopilotTab = dynamic(
  () => import('@/components/content-pipeline/AutopilotTab').then((m) => ({ default: m.AutopilotTab })),
  { ssr: false }
);
const PipelineView = dynamic(
  () => import('@/components/content-pipeline/PipelineView').then((m) => ({ default: m.PipelineView })),
  { ssr: false }
);
const CalendarView = dynamic(
  () => import('@/components/content-pipeline/CalendarView').then((m) => ({ default: m.CalendarView })),
  { ssr: false }
);
const LibraryTab = dynamic(
  () => import('@/components/content-pipeline/LibraryTab').then((m) => ({ default: m.LibraryTab })),
  { ssr: false }
);
const QuickWriteModal = dynamic(
  () => import('@/components/content-pipeline/QuickWriteModal').then((m) => ({ default: m.QuickWriteModal })),
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

export function PostsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'pipeline'
  );
  const [showQuickWrite, setShowQuickWrite] = useState(false);
  const [quickWriteDate, setQuickWriteDate] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { selectedProfileId, onProfileChange } = useProfileSelection();
  const [bufferLow, setBufferLow] = useState(false);

  // Auto-open Quick Write when navigated with ?quick_write=1
  useEffect(() => {
    if (searchParams.get('quick_write') === '1') {
      setShowQuickWrite(true);
      // Clean up the URL param
      const params = new URLSearchParams(searchParams.toString());
      params.delete('quick_write');
      const qs = params.toString();
      router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/content-pipeline/schedule/buffer')
      .then((r) => r.json())
      .then((data) => {
        const count = data.buffer?.length ?? 0;
        setBufferLow(count < 3);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

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

  const openQuickWrite = useCallback((date?: Date) => {
    setQuickWriteDate(date || null);
    setShowQuickWrite(true);
  }, []);

  const closeQuickWrite = useCallback(() => {
    setShowQuickWrite(false);
    setQuickWriteDate(null);
  }, []);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your content ideas, drafts, and publishing schedule
          </p>
        </div>
        <ProfileSwitcher
          selectedProfileId={selectedProfileId}
          onProfileChange={onProfileChange}
        />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === 'autopilot' && bufferLow && (
              <span className="ml-1 h-2 w-2 rounded-full bg-yellow-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Suspense fallback={<TabLoader />}>
        {activeTab === 'pipeline' && (
          <PipelineView
            key={refreshKey}
            profileId={selectedProfileId}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            onNewPost={() => openQuickWrite()}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarView onCreatePost={(date) => openQuickWrite(date)} />
        )}
        {activeTab === 'ideas' && (
          <IdeasTab
            profileId={selectedProfileId}
            onNewPost={() => openQuickWrite()}
          />
        )}
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'autopilot' && <AutopilotTab profileId={selectedProfileId} />}
      </Suspense>

      {/* Quick Write FAB */}
      <button
        onClick={() => openQuickWrite()}
        className="fixed bottom-6 right-6 z-30 flex h-auto items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        title="New Post"
      >
        <PenLine className="h-5 w-5" />
        <span className="text-sm font-medium">New Post</span>
      </button>
      {showQuickWrite && (
        <QuickWriteModal
          onClose={closeQuickWrite}
          onPostCreated={() => {
            handleTabChange('pipeline');
            setRefreshKey((k) => k + 1);
          }}
          profileId={selectedProfileId}
          scheduledDate={quickWriteDate}
        />
      )}
    </div>
  );
}
