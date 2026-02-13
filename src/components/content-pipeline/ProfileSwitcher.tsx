'use client';

import { useState, useEffect } from 'react';
import type { TeamProfile } from '@/lib/types/content-pipeline';

const STORAGE_KEY = 'ml-selected-profile-id';

interface ProfileSwitcherProps {
  selectedProfileId: string | null;
  onProfileChange: (profileId: string | null) => void;
  /** Pass profiles externally to avoid redundant API calls */
  profiles?: TeamProfile[];
}

export function ProfileSwitcher({ selectedProfileId, onProfileChange, profiles: externalProfiles }: ProfileSwitcherProps) {
  const [internalProfiles, setInternalProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(!externalProfiles);

  useEffect(() => {
    // Skip fetch if profiles are provided externally
    if (externalProfiles) return;

    fetch('/api/teams/profiles')
      .then(r => r.json())
      .then(data => {
        setInternalProfiles(data.profiles || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [externalProfiles]);

  const profiles = externalProfiles || internalProfiles;

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

/**
 * Hook for profile selection state with localStorage persistence.
 * Use this in parent components instead of plain useState.
 */
export function useProfileSelection() {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY) || null;
  });

  const onProfileChange = (profileId: string | null) => {
    setSelectedProfileId(profileId);
    if (profileId) {
      localStorage.setItem(STORAGE_KEY, profileId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return { selectedProfileId, onProfileChange };
}
