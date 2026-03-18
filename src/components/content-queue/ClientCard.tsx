'use client';

/**
 * ClientCard.
 * Presentational component for a single team row in the content queue.
 * Never fetches data; receives everything via props.
 */

import { Edit3, CheckCircle2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ClientCardProps {
  teamId: string;
  profileName: string;
  profileCompany: string;
  editedCount: number;
  totalCount: number;
  onEdit: (teamId: string) => void;
  onSubmit: (teamId: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ClientCard({
  teamId,
  profileName,
  profileCompany,
  editedCount,
  totalCount,
  onEdit,
  onSubmit,
}: ClientCardProps) {
  const allEdited = editedCount >= totalCount && totalCount > 0;
  const progress = totalCount > 0 ? (editedCount / totalCount) * 100 : 0;
  const initials = getInitials(profileName || 'U');

  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-3 transition-colors hover:bg-zinc-800">
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
        {initials}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-zinc-100">{profileName}</span>
          {profileCompany && (
            <span className="truncate text-xs text-zinc-400">{profileCompany}</span>
          )}
        </div>

        {/* Progress row */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {totalCount} posts &middot; {editedCount} edited
          </span>

          {/* Progress bar */}
          <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
            <div
              className={`h-full rounded-full transition-all ${allEdited ? 'bg-emerald-500' : 'bg-violet-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action button */}
      {allEdited ? (
        <button
          type="button"
          onClick={() => onSubmit(teamId)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Submit for Review
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onEdit(teamId)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
        >
          <Edit3 className="h-3.5 w-3.5" />
          Edit
        </button>
      )}
    </div>
  );
}
