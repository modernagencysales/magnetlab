'use client';

import { useState, useEffect } from 'react';
import type { TeamProfile } from '@/lib/types/content-pipeline';

interface ProfileSwitcherProps {
  selectedProfileId: string | null;
  onProfileChange: (profileId: string | null) => void;
}

export function ProfileSwitcher({ selectedProfileId, onProfileChange }: ProfileSwitcherProps) {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams/profiles')
      .then(r => r.json())
      .then(data => {
        setProfiles(data.profiles || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Don't render if no team or solo user
  if (loading || profiles.length <= 1) return null;

  const selected = profiles.find(p => p.id === selectedProfileId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Viewing as:</span>
      <select
        value={selectedProfileId || ''}
        onChange={e => onProfileChange(e.target.value || null)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">All Members</option>
        {profiles.map(p => (
          <option key={p.id} value={p.id}>
            {p.full_name}{p.title ? ` (${p.title})` : ''}
          </option>
        ))}
      </select>
      {selected && (
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {selected.avatar_url ? (
              <img src={selected.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              selected.full_name.charAt(0).toUpperCase()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
