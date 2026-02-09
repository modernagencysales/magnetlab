'use client';

import { useState } from 'react';
import { Mic, Brain, Lightbulb, FileText, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TranscriptsTab } from './TranscriptsTab';
import { KnowledgeBrainTab } from './KnowledgeBrainTab';
import { IdeasTab } from './IdeasTab';
import { PostsTab } from './PostsTab';
import { AutopilotTab } from './AutopilotTab';

type Tab = 'transcripts' | 'brain' | 'ideas' | 'posts' | 'autopilot';

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: 'transcripts', label: 'Transcripts', icon: Mic },
  { id: 'brain', label: 'AI Brain', icon: Brain },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'autopilot', label: 'Autopilot', icon: Zap },
];

export function ContentPipelineContent() {
  const [activeTab, setActiveTab] = useState<Tab>('transcripts');

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Content Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn call transcripts into LinkedIn posts on autopilot
        </p>
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
      {activeTab === 'transcripts' && <TranscriptsTab />}
      {activeTab === 'brain' && <KnowledgeBrainTab />}
      {activeTab === 'ideas' && <IdeasTab />}
      {activeTab === 'posts' && <PostsTab />}
      {activeTab === 'autopilot' && <AutopilotTab />}
    </div>
  );
}
