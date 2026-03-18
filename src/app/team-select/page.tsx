'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Loader2, Magnet, ArrowRight, UsersRound } from 'lucide-react';

import { logError } from '@/lib/utils/logger';
import { listTeams } from '@/frontend/api/teams';

interface TeamMembership {
  id: string;
  teamId: string;
  teamName: string;
  ownerId: string;
  role: 'owner' | 'member';
  via: 'direct' | 'team_link';
}

/**
 * Team selection page. Lets users switch between personal and team contexts.
 * Only auto-selects a team on first visit (no cookie set yet).
 * When the user explicitly navigates here, always show the full selection UI.
 */
export default function TeamSelectPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const data = await listTeams();
        // Normalize V2 UserTeamEntry list to local TeamMembership shape
        const entries = ((data as { teams?: unknown[] }).teams ?? []) as Array<{
          id: string;
          name: string;
          role: 'owner' | 'member';
          via?: 'direct' | 'team_link';
        }>;
        const normalized: TeamMembership[] = entries.map((e) => ({
          id: e.id,
          teamId: e.id,
          teamName: e.name,
          ownerId: '',
          role: e.role,
          via: e.via ?? 'direct',
        }));
        setMemberships(normalized);

        // Only auto-select when no cookie exists (first visit / fresh session).
        // If the user already has a cookie, they're explicitly switching — show the UI.
        const hasExistingContext = document.cookie
          .split('; ')
          .some((c) => c.startsWith('ml-team-context='));

        if (!hasExistingContext && normalized.length === 1) {
          selectTeam(normalized[0].teamId);
        }
      } catch (err) {
        logError('dashboard/team-select', err, { step: 'failed_to_fetch_memberships' });
      } finally {
        setLoading(false);
      }
    };

    fetchMemberships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTeam = (teamId: string) => {
    document.cookie = `ml-team-context=${teamId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    router.refresh();
    router.push('/');
    router.refresh();
  };

  const selectPersonal = () => {
    document.cookie = `ml-team-context=personal; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    router.refresh();
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold">Switch Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose which team to work in</p>
        </div>

        <div className="space-y-4">
          {/* Personal account option */}
          <button
            onClick={selectPersonal}
            className="flex w-full items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/50"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg text-primary-foreground shrink-0">
              <Magnet size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Personal Account</p>
              <p className="text-xs text-muted-foreground">Your own dashboard</p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground shrink-0" />
          </button>

          {memberships.length > 0 && (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">Teams</span>
              </div>
            </div>
          )}

          {memberships.map((m) => (
            <button
              key={m.teamId}
              onClick={() => selectTeam(m.teamId)}
              className="flex w-full items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/50"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-violet-500 rounded-lg text-white shrink-0">
                <UsersRound size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{m.teamName}</p>
                  {m.via === 'team_link' && (
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                      Linked
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.role === 'owner' ? 'Owner' : 'Member'}
                </p>
              </div>
              <ArrowRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
