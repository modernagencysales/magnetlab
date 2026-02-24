'use client';

import { useMemo } from 'react';
import { Activity, Brain, TrendingUp, History, Users, MessageSquare, Tag } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EditActivity {
  id: string;
  profile_id: string;
  content_type: string;
  auto_classified_changes: { patterns: Array<{ pattern: string; description: string }> } | null;
  ceo_note: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  voice_profile: {
    tone?: string;
    edit_patterns?: Array<{
      pattern: string;
      description: string;
      confidence: number;
      count: number;
      first_seen: string;
      last_seen: string;
    }>;
    positive_examples?: Array<{ content_id: string; type: string; note: string }>;
    last_evolved?: string;
    evolution_version?: number;
    vocabulary_preferences?: { avoid: string[]; prefer: string[] };
  } | null;
}

interface LearningDashboardProps {
  editActivity: EditActivity[];
  profiles: Profile[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPatternLabel(pattern: string): string {
  return pattern
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
  post: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  email: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  lead_magnet: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  sequence: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const PATTERN_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
];

function getPatternColor(pattern: string): string {
  let hash = 0;
  for (let i = 0; i < pattern.length; i++) {
    hash = (hash << 5) - hash + pattern.charCodeAt(i);
    hash |= 0;
  }
  return PATTERN_COLORS[Math.abs(hash) % PATTERN_COLORS.length];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LearningDashboard({ editActivity, profiles }: LearningDashboardProps) {
  // Compute stats
  const stats = useMemo(() => {
    const totalEdits = editActivity.length;

    const editsWithPatterns = editActivity.filter((e) => {
      const changes = e.auto_classified_changes;
      return changes && Array.isArray(changes.patterns) && changes.patterns.length > 0;
    }).length;

    const editsWithNotes = editActivity.filter(
      (e) => e.ceo_note && e.ceo_note.trim().length > 0
    ).length;

    const uniqueProfiles = new Set(editActivity.map((e) => e.profile_id)).size;

    return { totalEdits, editsWithPatterns, editsWithNotes, uniqueProfiles };
  }, [editActivity]);

  // Aggregate pattern frequencies
  const patternFrequencies = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const edit of editActivity) {
      const changes = edit.auto_classified_changes;
      if (changes && Array.isArray(changes.patterns)) {
        for (const p of changes.patterns) {
          counts[p.pattern] = (counts[p.pattern] || 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }, [editActivity]);

  const maxPatternCount = patternFrequencies.length > 0 ? patternFrequencies[0].count : 1;

  // Recent edits (top 20)
  const recentEdits = useMemo(() => editActivity.slice(0, 20), [editActivity]);

  // Build a profile name lookup
  const profileNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) {
      map[p.id] = p.full_name;
    }
    return map;
  }, [profiles]);

  // Profiles with voice data
  const profilesWithVoice = useMemo(
    () => profiles.filter((p) => p.voice_profile !== null),
    [profiles]
  );

  return (
    <div className="space-y-8">
      {/* ── Section 1: Summary Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="h-4 w-4 text-violet-500" />}
          value={stats.totalEdits}
          label="Total edits (30d)"
        />
        <StatCard
          icon={<Tag className="h-4 w-4 text-violet-500" />}
          value={stats.editsWithPatterns}
          label="With classified patterns"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4 text-violet-500" />}
          value={stats.editsWithNotes}
          label="With CEO notes"
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-violet-500" />}
          value={stats.uniqueProfiles}
          label="Unique profiles"
        />
      </div>

      {/* ── Section 2: Pattern Frequency ── */}
      <section>
        <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Pattern Frequency" />
        {patternFrequencies.length === 0 ? (
          <EmptyState message="No edit patterns detected yet. Patterns are classified automatically as content is edited." />
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <div className="space-y-3">
              {patternFrequencies.map(({ pattern, count }) => {
                const widthPercent = Math.round((count / maxPatternCount) * 100);
                return (
                  <div key={pattern} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 w-40 shrink-0 truncate font-medium">
                      {formatPatternLabel(pattern)}
                    </span>
                    <div className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-300"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-8 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Section 3: Voice Evolution ── */}
      <section>
        <SectionHeader icon={<Brain className="h-4 w-4" />} title="Voice Evolution" />
        {profilesWithVoice.length === 0 ? (
          <EmptyState message="No profiles with voice data yet. Voice profiles evolve after enough edits are captured." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {profilesWithVoice.map((profile) => (
              <VoiceProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4: Recent Edit Activity ── */}
      <section>
        <SectionHeader icon={<History className="h-4 w-4" />} title="Recent Edit Activity" />
        {recentEdits.length === 0 ? (
          <EmptyState message="No edits recorded in the last 30 days." />
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {recentEdits.map((edit, index) => {
                const patterns =
                  edit.auto_classified_changes?.patterns ?? [];
                return (
                  <div
                    key={edit.id}
                    className={`flex items-start gap-4 px-5 py-3.5 ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-zinc-900'
                        : 'bg-zinc-50 dark:bg-zinc-900/50'
                    }`}
                  >
                    {/* Date */}
                    <span className="text-xs text-zinc-400 w-20 shrink-0 pt-0.5">
                      {formatRelativeDate(edit.created_at)}
                    </span>

                    {/* Content type badge */}
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                        CONTENT_TYPE_COLORS[edit.content_type] ??
                        'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {edit.content_type}
                    </span>

                    {/* Patterns + CEO note */}
                    <div className="flex-1 min-w-0">
                      {patterns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {patterns.map((p, i) => (
                            <span
                              key={`${p.pattern}-${i}`}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getPatternColor(p.pattern)}`}
                              title={p.description}
                            >
                              {formatPatternLabel(p.pattern)}
                            </span>
                          ))}
                        </div>
                      )}
                      {edit.ceo_note && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                          {edit.ceo_note}
                        </p>
                      )}
                      {patterns.length === 0 && !edit.ceo_note && (
                        <span className="text-xs text-zinc-400 italic">No patterns or notes</span>
                      )}
                    </div>

                    {/* Profile name */}
                    <span className="text-xs text-zinc-400 shrink-0">
                      {profileNames[edit.profile_id] ?? 'Unknown'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{value}</p>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-zinc-400">{icon}</span>
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-8 text-center">
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function VoiceProfileCard({ profile }: { profile: Profile }) {
  const vp = profile.voice_profile;
  if (!vp) return null;

  const topPatterns = (vp.edit_patterns ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxCount = topPatterns.length > 0 ? topPatterns[0].count : 1;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {profile.full_name}
          </h3>
          {vp.tone && (
            <p className="text-xs text-zinc-400 mt-0.5">Tone: {vp.tone}</p>
          )}
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
            v{vp.evolution_version ?? 0}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4 text-xs">
        <div className="text-zinc-400">Last evolved</div>
        <div className="text-zinc-600 dark:text-zinc-300">
          {vp.last_evolved ? formatDate(vp.last_evolved) : 'Never'}
        </div>
        <div className="text-zinc-400">Positive examples</div>
        <div className="text-zinc-600 dark:text-zinc-300">
          {vp.positive_examples?.length ?? 0}
        </div>
      </div>

      {/* Top edit patterns */}
      {topPatterns.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-2">
            Top edit patterns
          </p>
          <div className="space-y-2">
            {topPatterns.map((p) => {
              const widthPercent = Math.round((p.count / maxCount) * 100);
              return (
                <div key={p.pattern} className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 w-28 shrink-0 truncate">
                    {formatPatternLabel(p.pattern)}
                  </span>
                  <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500/70 rounded-full"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 w-6 text-right tabular-nums">
                    {p.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic">No edit patterns yet</p>
      )}
    </div>
  );
}
