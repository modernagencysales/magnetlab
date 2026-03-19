/** ConversationList. Recent copilot conversations list. Constraint: Client-only, no data fetching. Shared between homepage and command bar. */

'use client';

import type { RecentConversation } from '@/frontend/hooks/api/useHomepageData';

// ─── Props ────────────────────────────────────────────────

interface ConversationListProps {
  conversations: RecentConversation[];
  onSelect: (id: string) => void;
  maxItems?: number;
}

// ─── Relative time ────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  } catch {
    return '';
  }
}

// ─── Component ────────────────────────────────────────────

export function ConversationList({ conversations, onSelect, maxItems }: ConversationListProps) {
  const items = maxItems ? conversations.slice(0, maxItems) : conversations;

  return (
    <div className="flex flex-col gap-1 max-w-lg mx-auto w-full">
      {items.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className="bg-card hover:bg-accent rounded-lg px-4 py-3 cursor-pointer transition-colors flex justify-between items-center text-left w-full"
        >
          <span className="text-sm text-foreground truncate flex-1 min-w-0 pr-2">
            {conversation.title}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
        </button>
      ))}
    </div>
  );
}
