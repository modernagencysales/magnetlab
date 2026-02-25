'use client';

import { useState, useEffect } from 'react';
import { Brain, Layers, AlertTriangle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KnowledgeOverview } from './KnowledgeOverview';
import { TopicBrowser } from './TopicBrowser';
import { GapAnalysis } from './GapAnalysis';
import { KnowledgeSearch } from './KnowledgeSearch';

const SUBTABS = [
  { id: 'overview', label: 'Overview', icon: Brain },
  { id: 'topics', label: 'Topics', icon: Layers },
  { id: 'gaps', label: 'Gaps', icon: AlertTriangle },
  { id: 'search', label: 'Search', icon: Search },
] as const;

type SubtabId = typeof SUBTABS[number]['id'];

function getActiveTeamFromCookie(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)ml-team-context=([^;]*)/);
  return match?.[1] || undefined;
}

export function KnowledgeDashboard() {
  const [activeTab, setActiveTab] = useState<SubtabId>('overview');
  const [teamId, setTeamId] = useState<string | undefined>();
  const [userTeamId, setUserTeamId] = useState<string | undefined>();
  useEffect(() => {
    // Read the active team from the cookie (set by team-select page)
    const cookieTeamId = getActiveTeamFromCookie();
    if (cookieTeamId) {
      setUserTeamId(cookieTeamId);
      setTeamId(cookieTeamId);
    } else {
      // Personal mode — check if user has any teams for the toggle
      fetch('/api/teams')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          const firstTeam =
            data.owned?.[0]?.team_id ?? data.member?.[0]?.team_id ?? undefined;
          setUserTeamId(firstTeam);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Knowledge</h2>
            <p className="text-sm text-muted-foreground">Your AI-powered knowledge base</p>
          </div>
        </div>
        {userTeamId && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-1">
            <button
              onClick={() => setTeamId(undefined)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                !teamId ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              Personal
            </button>
            <button
              onClick={() => setTeamId(userTeamId)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                teamId ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              Team
            </button>
          </div>
        )}
      </div>

      {/* Subtab navigation */}
      <div className="mb-6 flex gap-1 rounded-lg border bg-muted/50 p-1">
        {SUBTABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'overview' && <KnowledgeOverview teamId={teamId} />}
      {activeTab === 'topics' && <TopicBrowser teamId={teamId} />}
      {activeTab === 'gaps' && <GapAnalysis teamId={teamId} />}
      {activeTab === 'search' && <KnowledgeSearch teamId={teamId} />}
    </div>
  );
}
