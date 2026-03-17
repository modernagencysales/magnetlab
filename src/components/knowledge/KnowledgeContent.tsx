'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Mic, Brain, Loader2 } from 'lucide-react';
import { PageContainer, PageTitle, Button } from '@magnetlab/magnetui';
import {
  ProfileSwitcher,
  useProfileSelection,
} from '@/components/content-pipeline/ProfileSwitcher';

const TranscriptsTab = dynamic(
  () =>
    import('@/components/content-pipeline/TranscriptsTab').then((m) => ({
      default: m.TranscriptsTab,
    })),
  { ssr: false }
);
const KnowledgeBrainTab = dynamic(
  () =>
    import('@/components/content-pipeline/KnowledgeBrainTab').then((m) => ({
      default: m.KnowledgeBrainTab,
    })),
  { ssr: false }
);

type Tab = 'transcripts' | 'brain';

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: 'brain', label: 'AI Brain', icon: Brain },
  { id: 'transcripts', label: 'Transcripts', icon: Mic },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function getTeamFromCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)ml-team-context=([^;]*)/);
  return match?.[1] || undefined;
}

export function KnowledgeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'brain'
  );
  const { selectedProfileId, onProfileChange } = useProfileSelection();
  const [teamId, setTeamId] = useState<string | undefined>();
  const [teamContextReady, setTeamContextReady] = useState(false);

  useEffect(() => {
    setTeamId(getTeamFromCookie());
    setTeamContextReady(true);
  }, []);

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'brain') {
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
          title="Knowledge"
          description="Import transcripts and build your AI knowledge base"
          actions={
            <ProfileSwitcher
              selectedProfileId={selectedProfileId}
              onProfileChange={onProfileChange}
            />
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
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        <Suspense fallback={<TabLoader />}>
          {!teamContextReady ? (
            <TabLoader />
          ) : (
            <>
              {activeTab === 'transcripts' && <TranscriptsTab profileId={selectedProfileId} />}
              {activeTab === 'brain' && <KnowledgeBrainTab teamId={teamId} />}
            </>
          )}
        </Suspense>
      </div>
    </PageContainer>
  );
}
