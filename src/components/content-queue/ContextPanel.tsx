'use client';

/**
 * ContextPanel.
 * Right column of the editing view — writing style, content brief, and all posts overview.
 * Collapsible accordion sections. Never fetches data; receives everything via props.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, PanelRightClose, PanelRight } from 'lucide-react';
import type { QueueTeamWritingStyle, QueuePost } from '@/frontend/api/content-queue';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ContextPanelProps {
  writingStyle: QueueTeamWritingStyle | null;
  currentPost: QueuePost | null;
  allPosts: QueuePost[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// ─── Accordion Section ─────────────────────────────────────────────────────

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-700/50">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800/50"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        ) : (
          <ChevronRight className="h-3 w-3 text-zinc-500" />
        )}
        {title}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ContextPanel({
  writingStyle,
  currentPost,
  allPosts,
  isCollapsed,
  onToggleCollapse,
}: ContextPanelProps) {
  // Collapsed state — just show toggle button
  if (isCollapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-l border-zinc-700 bg-zinc-900 pt-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Show context panel"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-[260px] shrink-0 flex-col border-l border-zinc-700 bg-zinc-900">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
        <span className="text-xs font-medium text-zinc-300">Context</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Collapse panel"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Writing Style — always visible */}
        <div className="border-b border-zinc-700/50 px-3 py-3">
          <h3 className="mb-2 text-xs font-medium text-zinc-300">Writing Style</h3>
          {writingStyle ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-violet-400">{writingStyle.name}</span>
              {writingStyle.tone_keywords && writingStyle.tone_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {writingStyle.tone_keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
              {writingStyle.writing_rules && writingStyle.writing_rules.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {writingStyle.writing_rules.map((rule, i) => (
                    <li key={i} className="text-[11px] leading-tight text-zinc-400">
                      &bull; {rule}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">No writing style configured</p>
          )}
        </div>

        {/* Content Brief — collapsible */}
        {currentPost && (
          <AccordionSection title="Content Brief">
            <div className="flex flex-col gap-1.5">
              {currentPost.idea_title && (
                <div>
                  <span className="text-[10px] uppercase text-zinc-500">Topic</span>
                  <p className="text-xs text-zinc-300">{currentPost.idea_title}</p>
                </div>
              )}
              {currentPost.idea_content_type && (
                <div>
                  <span className="text-[10px] uppercase text-zinc-500">Type</span>
                  <p className="text-xs text-zinc-300">{currentPost.idea_content_type}</p>
                </div>
              )}
              {!currentPost.idea_title && !currentPost.idea_content_type && (
                <p className="text-[11px] text-zinc-500">No brief available</p>
              )}
            </div>
          </AccordionSection>
        )}

        {/* All Posts Overview — collapsible */}
        <AccordionSection title={`All Posts (${allPosts.length})`}>
          <div className="flex flex-col gap-1">
            {allPosts.map((post, i) => (
              <div key={post.id} className="flex items-center gap-2 text-[11px]">
                <div
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    post.edited_at ? 'bg-emerald-400' : 'bg-zinc-500'
                  }`}
                />
                <span className="truncate text-zinc-400">
                  {i + 1}. {post.draft_content?.split('\n')[0]?.slice(0, 30) || '(empty)'}
                </span>
              </div>
            ))}
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}
