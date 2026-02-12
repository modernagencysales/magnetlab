'use client';

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Mic, Brain, Lightbulb, FileText, Zap, Loader2, LayoutGrid, LayoutTemplate, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileSwitcher } from './ProfileSwitcher';

// Dynamic imports for code splitting — each tab loads only when selected
const TranscriptsTab = dynamic(() => import('./TranscriptsTab').then((m) => ({ default: m.TranscriptsTab })), { ssr: false });
const KnowledgeBrainTab = dynamic(() => import('./KnowledgeBrainTab').then((m) => ({ default: m.KnowledgeBrainTab })), { ssr: false });
const IdeasTab = dynamic(() => import('./IdeasTab').then((m) => ({ default: m.IdeasTab })), { ssr: false });
const PostsTab = dynamic(() => import('./PostsTab').then((m) => ({ default: m.PostsTab })), { ssr: false });
const AutopilotTab = dynamic(() => import('./AutopilotTab').then((m) => ({ default: m.AutopilotTab })), { ssr: false });
const PipelineTab = dynamic(() => import('./PipelineTab').then((m) => ({ default: m.PipelineTab })), { ssr: false });
const TemplatesTab = dynamic(() => import('./TemplatesTab').then((m) => ({ default: m.TemplatesTab })), { ssr: false });
const QuickWriteModal = dynamic(() => import('./QuickWriteModal').then((m) => ({ default: m.QuickWriteModal })), { ssr: false });

type Tab = 'transcripts' | 'brain' | 'ideas' | 'posts' | 'pipeline' | 'templates' | 'autopilot';

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: 'transcripts', label: 'Transcripts', icon: Mic },
  { id: 'brain', label: 'AI Brain', icon: Brain },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'pipeline', label: 'Pipeline', icon: LayoutGrid },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'autopilot', label: 'Autopilot', icon: Zap },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ContentPipelineContent() {
  const [activeTab, setActiveTab] = useState<Tab>('transcripts');
  const [showQuickWrite, setShowQuickWrite] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Content Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn call transcripts into LinkedIn posts on autopilot
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
            onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'ideas' && <IdeasTab profileId={selectedProfileId} />}
        {activeTab === 'posts' && <PostsTab profileId={selectedProfileId} />}
        {activeTab === 'pipeline' && <PipelineTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'autopilot' && <AutopilotTab profileId={selectedProfileId} />}
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
          onPostCreated={() => {}}
          profileId={selectedProfileId}
        />
      )}
    </div>
  );
}
