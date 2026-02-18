'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Loader2, Magnet, ArrowRight, UsersRound } from 'lucide-react';

import { logError } from '@/lib/utils/logger';

interface TeamMembership {
  id: string;
  teamId: string;
  teamName: string;
  ownerId: string;
  role: 'owner' | 'member';
}

export default function TeamSelectPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const res = await fetch('/api/team/memberships');
        if (res.ok) {
          const data = await res.json();
          setMemberships(data);

          // Auto-redirect if only one team
          if (data.length === 1) {
            selectTeam(data[0].teamId);
          }
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
    router.push('/');
  };

  const selectPersonal = () => {
    document.cookie = 'ml-team-context=; path=/; max-age=0';
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-4">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Switch Team</h1>
        <p className="text-sm text-muted-foreground">
          Choose which team to work in
        </p>
      </div>

      <div className="space-y-3">
        {/* Personal account option */}
        <button
          onClick={selectPersonal}
          className="flex items-center gap-4 w-full rounded-lg border p-4 hover:border-primary/30 hover:bg-muted/50 transition-colors text-left"
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
            className="flex items-center gap-4 w-full rounded-lg border p-4 hover:border-primary/30 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-violet-500 rounded-lg text-white shrink-0">
              <UsersRound size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{m.teamName}</p>
              <p className="text-xs text-muted-foreground">{m.role === 'owner' ? 'Owner' : 'Member'}</p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
