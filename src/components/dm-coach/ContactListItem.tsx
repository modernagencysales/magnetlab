'use client';

/**
 * ContactListItem. Single contact row in the left sidebar.
 * Shows name, headline, stage badge, goal label, and last message time.
 * Never imports server-only modules.
 */

import { Badge } from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';
import type { DmcContact } from '@/lib/types/dm-coach';
import { CONVERSATION_GOALS, QUALIFICATION_LADDER } from '@/lib/types/dm-coach';

// ─── Types ─────────────────────────────────────────────────────────

interface ContactListItemProps {
  contact: DmcContact;
  isSelected: boolean;
  onSelect: () => void;
}

// ─── Stage Colors ──────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  unknown: 'bg-muted text-muted-foreground',
  situation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pain: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  impact: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  vision: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  capability: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  commitment: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

// ─── Component ─────────────────────────────────────────────────────

export function ContactListItem({ contact, isSelected, onSelect }: ContactListItemProps) {
  const stageLabel = QUALIFICATION_LADDER[contact.qualification_stage]?.label ?? 'New';
  const goalLabel = CONVERSATION_GOALS[contact.conversation_goal]?.label ?? '';
  const stageColor = STAGE_COLOR[contact.qualification_stage] ?? STAGE_COLOR.unknown;

  const subtitle = contact.headline || contact.company || null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors',
        isSelected ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/50'
      )}
    >
      {/* Row 1: name + stage badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{contact.name}</span>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
            stageColor
          )}
        >
          {stageLabel}
        </span>
      </div>

      {/* Row 2: subtitle + goal */}
      <div className="flex items-center justify-between gap-2">
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
        {goalLabel && (
          <Badge variant="outline" className="shrink-0 text-[10px] leading-none">
            {goalLabel}
          </Badge>
        )}
      </div>

      {/* Row 3: last message time */}
      {contact.last_message_at && (
        <span className="text-[10px] text-muted-foreground">
          Last message: {formatRelative(contact.last_message_at)}
        </span>
      )}
    </button>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatRelative(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
