'use client';

/**
 * AssetPicker.
 * Per-client asset review view — shows posts, lead magnets, and funnels.
 * Intermediate view between queue list and post editor.
 * Never fetches data; receives everything via props.
 */

import { useState } from 'react';
import { ArrowLeft, Edit3, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import type { QueueTeam } from '@/frontend/api/content-queue';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AssetPickerProps {
  team: QueueTeam;
  onEditPosts: () => void;
  onBack: () => void;
  onReviewLeadMagnet: (lmId: string, reviewed: boolean) => Promise<void>;
  onReviewFunnel: (funnelId: string, reviewed: boolean) => Promise<void>;
  onSubmitPosts: () => Promise<void>;
  onSubmitAssets: () => Promise<void>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getArchetypeLabel(archetype: string): string {
  return archetype
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h3>
  );
}

function ReviewToggle({
  reviewed,
  label,
  onToggle,
  loading,
}: {
  reviewed: boolean;
  label: string;
  onToggle: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        reviewed
          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
      }`}
      aria-label={label}
    >
      {reviewed ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      {reviewed ? 'Reviewed' : 'Mark Reviewed'}
    </button>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AssetPicker({
  team,
  onEditPosts,
  onBack,
  onReviewLeadMagnet,
  onReviewFunnel,
  onSubmitPosts,
  onSubmitAssets,
}: AssetPickerProps) {
  const [submittingPosts, setSubmittingPosts] = useState(false);
  const [submittingAssets, setSubmittingAssets] = useState(false);
  const [loadingLm, setLoadingLm] = useState<string | null>(null);
  const [loadingFunnel, setLoadingFunnel] = useState<string | null>(null);

  const allPostsEdited = team.total_count > 0 && team.edited_count >= team.total_count;
  const allLMsReviewed =
    team.lm_total_count > 0 && team.lm_reviewed_count >= team.lm_total_count;
  const allFunnelsReviewed =
    team.funnel_total_count === 0 || team.funnel_reviewed_count >= team.funnel_total_count;
  const allAssetsReviewed = allLMsReviewed && allFunnelsReviewed;

  const postsProgress =
    team.total_count > 0 ? Math.round((team.edited_count / team.total_count) * 100) : 0;

  async function handleSubmitPosts() {
    setSubmittingPosts(true);
    try {
      await onSubmitPosts();
    } finally {
      setSubmittingPosts(false);
    }
  }

  async function handleSubmitAssets() {
    setSubmittingAssets(true);
    try {
      await onSubmitAssets();
    } finally {
      setSubmittingAssets(false);
    }
  }

  async function handleToggleLM(lmId: string, currentlyReviewed: boolean) {
    setLoadingLm(lmId);
    try {
      await onReviewLeadMagnet(lmId, !currentlyReviewed);
    } finally {
      setLoadingLm(null);
    }
  }

  async function handleToggleFunnel(funnelId: string, currentlyReviewed: boolean) {
    setLoadingFunnel(funnelId);
    try {
      await onReviewFunnel(funnelId, !currentlyReviewed);
    } finally {
      setLoadingFunnel(null);
    }
  }

  function openInEditor(path: string, teamId: string) {
    // Set team context cookie before navigating
    document.cookie = `ml-team-context=${teamId}; path=/; max-age=86400`;
    window.open(path, '_blank');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          aria-label="Back to queue"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="h-4 w-px bg-zinc-700" />
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{team.profile_name}</h1>
          {team.profile_company && (
            <p className="text-sm text-zinc-400">{team.profile_company}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Posts Section */}
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
          <SectionHeader>Posts</SectionHeader>

          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm text-zinc-300">
              {team.total_count} posts &middot; {team.edited_count} edited
            </span>
            {/* Progress bar */}
            <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
              <div
                className={`h-full rounded-full transition-all ${allPostsEdited ? 'bg-emerald-500' : 'bg-violet-500'}`}
                style={{ width: `${postsProgress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">{postsProgress}%</span>
          </div>

          <button
            type="button"
            onClick={onEditPosts}
            className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Posts
          </button>
        </div>

        {/* Lead Magnets + Funnels Section */}
        {team.lead_magnets.length > 0 && (
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
            <SectionHeader>Lead Magnets & Funnels</SectionHeader>

            <div className="flex flex-col gap-4">
              {team.lead_magnets.map((lm) => (
                <div key={lm.id} className="flex flex-col gap-2">
                  {/* Lead Magnet Row */}
                  <div className="flex items-center gap-3 rounded-md bg-zinc-700/40 px-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-zinc-100">
                        {lm.title}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {getArchetypeLabel(lm.archetype)} &middot;{' '}
                        <span
                          className={
                            lm.status === 'published' ? 'text-emerald-400' : 'text-zinc-400'
                          }
                        >
                          {lm.status}
                        </span>
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ReviewToggle
                        reviewed={lm.reviewed_at !== null}
                        label={`Mark lead magnet ${lm.title} as reviewed`}
                        onToggle={() => handleToggleLM(lm.id, lm.reviewed_at !== null)}
                        loading={loadingLm === lm.id}
                      />
                      <button
                        type="button"
                        onClick={() => openInEditor(`/magnets/${lm.id}`, team.team_id)}
                        className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
                        aria-label={`Review ${lm.title} in editor`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Review in Editor
                      </button>
                    </div>
                  </div>

                  {/* Funnel rows under this LM */}
                  {lm.funnels.map((funnel) => (
                    <div
                      key={funnel.id}
                      className="ml-4 flex items-center gap-3 rounded-md bg-zinc-700/20 px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm text-zinc-200">
                          /{funnel.slug}
                        </span>
                        <span className="text-xs text-zinc-500">
                          Funnel &middot;{' '}
                          <span
                            className={
                              funnel.is_published ? 'text-emerald-400' : 'text-zinc-400'
                            }
                          >
                            {funnel.is_published ? 'published' : 'draft'}
                          </span>
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ReviewToggle
                          reviewed={funnel.reviewed_at !== null}
                          label={`Mark funnel /${funnel.slug} as reviewed`}
                          onToggle={() =>
                            handleToggleFunnel(funnel.id, funnel.reviewed_at !== null)
                          }
                          loading={loadingFunnel === funnel.id}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            openInEditor(
                              `/magnets/${lm.id}?tab=funnel`,
                              team.team_id
                            )
                          }
                          className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
                          aria-label={`Review funnel /${funnel.slug}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Review Funnel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmitPosts}
            disabled={!allPostsEdited || submittingPosts}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submittingPosts ? 'Submitting...' : 'Submit Posts'}
          </button>

          {team.lm_total_count > 0 && (
            <button
              type="button"
              onClick={handleSubmitAssets}
              disabled={!allAssetsReviewed || submittingAssets}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submittingAssets ? 'Submitting...' : 'Submit Assets'}
            </button>
          )}

          {!allPostsEdited && (
            <p className="text-xs text-zinc-500">
              {team.total_count - team.edited_count} post
              {team.total_count - team.edited_count !== 1 ? 's' : ''} still need editing
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
