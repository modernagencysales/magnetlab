'use client';

import { useState } from 'react';
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
      <div className="text-center py-8 text-zinc-500 text-sm">
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
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
          >
            {/* Version header */}
            <div className="flex items-start justify-between p-3 gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[11px] font-semibold">
                    v{version.version}
                  </span>
                  <span className="text-xs text-zinc-400">{timeAgo(version.created_at)}</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-1">
                  {version.change_note || (
                    <span className="text-zinc-400 italic">No note</span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">by {version.changed_by}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : version.id)}
                  className="px-2.5 py-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
              <div className="border-t border-zinc-200 dark:border-zinc-700 p-3">
                {/* Tab toggle for system vs user prompt diff */}
                <div className="flex gap-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setDiffTab('system')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      diffTab === 'system'
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
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
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    User Prompt
                  </button>
                </div>
                <PromptDiffViewer
                  oldText={
                    diffTab === 'system' ? version.system_prompt : version.user_prompt
                  }
                  newText={
                    diffTab === 'system' ? currentSystemPrompt : currentUserPrompt
                  }
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
