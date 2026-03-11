'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@magnetlab/magnetui';
import type { TeamProfile } from '@/lib/types/content-pipeline';
import * as teamsApi from '@/frontend/api/teams';

const STORAGE_KEY = 'ml-selected-profile-id';

interface ProfileSwitcherProps {
  selectedProfileId: string | null;
  onProfileChange: (profileId: string | null) => void;
  /** Pass profiles externally to avoid redundant API calls */
  profiles?: TeamProfile[];
}

export function ProfileSwitcher({
  selectedProfileId,
  onProfileChange,
  profiles: externalProfiles,
}: ProfileSwitcherProps) {
  const [internalProfiles, setInternalProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(!externalProfiles);

  useEffect(() => {
    // Skip fetch if profiles are provided externally
    if (externalProfiles) return;

    teamsApi
      .listProfiles()
      .then((profiles) => setInternalProfiles((profiles || []) as TeamProfile[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [externalProfiles]);

  const profiles = externalProfiles || internalProfiles;

  // Don't render if no team or solo user
  if (loading || profiles.length <= 1) return null;

  const selected = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Viewing as:</span>
      <Select value={selectedProfileId || ''} onValueChange={(v) => onProfileChange(v || null)}>
        <SelectTrigger className="h-9 w-[200px]">
          <SelectValue placeholder="All Members" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Members</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.full_name}
              {p.title ? ` (${p.title})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {selected.avatar_url ? (
              <Image
                src={selected.avatar_url}
                alt=""
                width={24}
                height={24}
                className="rounded-full object-cover"
              />
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
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Sync from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSelectedProfileId(stored);
    }
  }, []);

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
