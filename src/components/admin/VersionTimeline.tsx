'use client';

import { useState } from 'react';
import { Badge } from '@magnetlab/magnetui';
import { PromptDiffViewer } from './PromptDiffViewer';

interface Version {
  id: string;
  version: number;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  change_note: string | null;
  changed_by: string;
  created_at: string;
}

interface Props {
  versions: Version[];
  currentSystemPrompt: string;
  currentUserPrompt: string;
  onRestore: (versionId: string) => void;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function VersionTimeline({
  versions,
  currentSystemPrompt,
  currentUserPrompt,
  onRestore,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffTab, setDiffTab] = useState<'system' | 'user'>('system');

  if (versions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No version history yet. Save changes to create the first version.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => {
        const isExpanded = expandedId === version.id;
        return (
          <div
            key={version.id}
            className="rounded-lg border border-border bg-card"
          >
            {/* Version header */}
            <div className="flex items-start justify-between p-3 gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="purple">v{version.version}</Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(version.created_at)}</span>
                </div>
                <p className="text-xs line-clamp-1 text-muted-foreground">
                  {version.change_note || <span className="italic">No note</span>}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">by {version.changed_by}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : version.id)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  {isExpanded ? 'Hide Diff' : 'View Diff'}
                </button>
                <button
                  type="button"
                  onClick={() => onRestore(version.id)}
                  className="px-2.5 py-1 text-xs rounded-md border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                >
                  Restore
                </button>
              </div>
            </div>

            {/* Diff viewer (expanded) */}
            {isExpanded && (
              <div className="border-t border-border p-3">
                {/* Tab toggle for system vs user prompt diff */}
                <div className="flex gap-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setDiffTab('system')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      diffTab === 'system'
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    System Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiffTab('user')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      diffTab === 'user'
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    User Prompt
                  </button>
                </div>
                <PromptDiffViewer
                  oldText={diffTab === 'system' ? version.system_prompt : version.user_prompt}
                  newText={diffTab === 'system' ? currentSystemPrompt : currentUserPrompt}
                  oldLabel={`v${version.version}`}
                  newLabel="Current"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
