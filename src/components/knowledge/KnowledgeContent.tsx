'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Mic, Brain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileSwitcher } from '@/components/content-pipeline/ProfileSwitcher';

const TranscriptsTab = dynamic(
  () => import('@/components/content-pipeline/TranscriptsTab').then((m) => ({ default: m.TranscriptsTab })),
  { ssr: false }
);
const KnowledgeBrainTab = dynamic(
  () => import('@/components/content-pipeline/KnowledgeBrainTab').then((m) => ({ default: m.KnowledgeBrainTab })),
  { ssr: false }
);

type Tab = 'transcripts' | 'brain';

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: 'transcripts', label: 'Transcripts', icon: Mic },
  { id: 'brain', label: 'AI Brain', icon: Brain },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function KnowledgeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'transcripts'
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'transcripts') {
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
          <h1 className="text-2xl font-semibold">Knowledge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Import transcripts and build your AI knowledge base
          </p>
        </div>
        <ProfileSwitcher
          selectedProfileId={selectedProfileId}
          onProfileChange={setSelectedProfileId}
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
        {activeTab === 'transcripts' && <TranscriptsTab profileId={selectedProfileId} />}
        {activeTab === 'brain' && <KnowledgeBrainTab />}
      </Suspense>
    </div>
  );
}
