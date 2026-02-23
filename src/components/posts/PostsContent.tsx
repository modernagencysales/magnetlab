'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Lightbulb, FileText, LayoutGrid, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileSwitcher, useProfileSelection } from '@/components/content-pipeline/ProfileSwitcher';

const IdeasTab = dynamic(
  () => import('@/components/content-pipeline/IdeasTab').then((m) => ({ default: m.IdeasTab })),
  { ssr: false }
);
const PostsTab = dynamic(
  () => import('@/components/content-pipeline/PostsTab').then((m) => ({ default: m.PostsTab })),
  { ssr: false }
);
const PipelineTab = dynamic(
  () => import('@/components/content-pipeline/PipelineTab').then((m) => ({ default: m.PipelineTab })),
  { ssr: false }
);
const AutopilotTab = dynamic(
  () => import('@/components/content-pipeline/AutopilotTab').then((m) => ({ default: m.AutopilotTab })),
  { ssr: false }
);
const TemplatesTab = dynamic(
  () => import('@/components/content-pipeline/TemplatesTab').then((m) => ({ default: m.TemplatesTab })),
  { ssr: false }
);
const SwipeFileContent = dynamic(
  () => import('@/components/swipe-file/SwipeFileContent').then((m) => ({ default: m.SwipeFileContent })),
  { ssr: false }
);
const QuickWriteModal = dynamic(
  () => import('@/components/content-pipeline/QuickWriteModal').then((m) => ({ default: m.QuickWriteModal })),
  { ssr: false }
);

type Tab = 'ideas' | 'drafts' | 'schedule' | 'templates' | 'inspiration';

const TABS: { id: Tab; label: string; icon: typeof Lightbulb }[] = [
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'schedule', label: 'Schedule', icon: LayoutGrid },
  { id: 'templates', label: 'Templates', icon: Sparkles },
  { id: 'inspiration', label: 'Inspiration', icon: BookOpen },
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
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'ideas'
  );
  const [showQuickWrite, setShowQuickWrite] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { selectedProfileId, onProfileChange } = useProfileSelection();

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'ideas') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
  }

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
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Suspense fallback={<TabLoader />}>
        {activeTab === 'ideas' && <IdeasTab profileId={selectedProfileId} />}
        {activeTab === 'drafts' && <PostsTab key={refreshKey} profileId={selectedProfileId} />}
        {activeTab === 'schedule' && (
          <div className="space-y-8">
            <PipelineTab />
            <AutopilotTab profileId={selectedProfileId} />
          </div>
        )}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'inspiration' && <SwipeFileContent />}
      </Suspense>

      {/* Quick Write FAB */}
      <button
        onClick={() => setShowQuickWrite(true)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        title="Quick Write"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      {showQuickWrite && (
        <QuickWriteModal
          onClose={() => setShowQuickWrite(false)}
          onPostCreated={() => {
            // Switch to drafts tab and refresh it
            handleTabChange('drafts');
            setRefreshKey((k) => k + 1);
          }}
          profileId={selectedProfileId}
        />
      )}
    </div>
  );
}
