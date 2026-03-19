'use client';

/**
 * ClientCard.
 * Presentational component for a single team row in the content queue.
 * Shows posts progress, lead magnet progress, and funnel progress.
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
  lmReviewedCount: number;
  lmTotalCount: number;
  funnelReviewedCount: number;
  funnelTotalCount: number;
  onEdit: (teamId: string) => void;
  onSubmitPosts: (teamId: string) => void;
  onSubmitAssets: (teamId: string) => void;
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
  lmReviewedCount,
  lmTotalCount,
  funnelReviewedCount,
  funnelTotalCount,
  onEdit,
  onSubmitPosts,
  onSubmitAssets,
}: ClientCardProps) {
  const allPostsEdited = totalCount > 0 && editedCount >= totalCount;
  const postsProgress = totalCount > 0 ? (editedCount / totalCount) * 100 : 0;
  const initials = getInitials(profileName || 'U');

  // Assets are complete when all LMs + all funnels are reviewed
  const allAssetsReviewed =
    lmTotalCount > 0 &&
    lmReviewedCount >= lmTotalCount &&
    (funnelTotalCount === 0 || funnelReviewedCount >= funnelTotalCount);

  const hasAssets = lmTotalCount > 0;

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
          {initials}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{profileName}</span>
            {profileCompany && (
              <span className="truncate text-xs text-muted-foreground">{profileCompany}</span>
            )}
          </div>

          {/* Posts progress row */}
          <div className="flex items-center gap-3">
            <span className="min-w-[140px] text-xs text-muted-foreground">
              {totalCount} posts &middot; {editedCount} edited
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all ${allPostsEdited ? 'bg-emerald-500' : 'bg-violet-500'}`}
                style={{ width: `${postsProgress}%` }}
              />
            </div>
            {allPostsEdited && (
              <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Posts ready
              </span>
            )}
          </div>

          {/* Lead magnet progress row */}
          {hasAssets && (
            <div className="flex items-center gap-3">
              <span className="min-w-[140px] text-xs text-muted-foreground">
                {lmTotalCount} lead magnet{lmTotalCount !== 1 ? 's' : ''} &middot; {lmReviewedCount}{' '}
                reviewed
              </span>
              <div className="h-1.5 flex-1 rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${lmReviewedCount >= lmTotalCount ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{
                    width: `${lmTotalCount > 0 ? (lmReviewedCount / lmTotalCount) * 100 : 0}%`,
                  }}
                />
              </div>
              {lmReviewedCount >= lmTotalCount ? (
                <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓
                </span>
              ) : (
                <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                  needs review
                </span>
              )}
            </div>
          )}

          {/* Funnel progress row */}
          {funnelTotalCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="min-w-[140px] text-xs text-muted-foreground">
                {funnelTotalCount} funnel{funnelTotalCount !== 1 ? 's' : ''} &middot;{' '}
                {funnelReviewedCount} reviewed
              </span>
              <div className="h-1.5 flex-1 rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${funnelReviewedCount >= funnelTotalCount ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{
                    width: `${(funnelReviewedCount / funnelTotalCount) * 100}%`,
                  }}
                />
              </div>
              {funnelReviewedCount >= funnelTotalCount ? (
                <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓
                </span>
              ) : (
                <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                  needs review
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-col gap-1.5">
          {!allPostsEdited && (
            <button
              type="button"
              onClick={() => onEdit(teamId)}
              className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Review
            </button>
          )}

          {allPostsEdited && (
            <button
              type="button"
              onClick={() => onSubmitPosts(teamId)}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Submit Posts
            </button>
          )}

          {hasAssets && allAssetsReviewed && (
            <button
              type="button"
              onClick={() => onSubmitAssets(teamId)}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Submit Assets
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
