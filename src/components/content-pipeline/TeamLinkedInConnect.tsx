'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { TeamProfileWithConnection } from '@/lib/types/content-pipeline';

interface TeamLinkedInConnectProps {
  profiles: TeamProfileWithConnection[];
  onRefresh: () => void;
}

/**
 * Banner component that shows when team profiles are missing LinkedIn connections.
 * Each disconnected profile gets a link to start the Unipile OAuth flow with
 * team_profile_id encoded so the webhook stores the connection correctly.
 */
export function TeamLinkedInConnect({ profiles }: TeamLinkedInConnectProps) {
  const disconnected = profiles.filter((p) => !p.linkedin_connected);

  if (disconnected.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {disconnected.length} member{disconnected.length !== 1 ? 's' : ''} not connected to LinkedIn
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {disconnected.map((profile) => (
              <a
                key={profile.id}
                href={`/api/linkedin/connect?team_profile_id=${profile.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
              >
                Connect {profile.full_name}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
