'use client';

import { cn } from '@/lib/utils';
import type { ContentPillar } from '@/lib/types/content-pipeline';
import { CONTENT_PILLAR_LABELS } from '@/lib/types/content-pipeline';

const PILLAR_STYLES: Record<ContentPillar, string> = {
  moments_that_matter: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  teaching_promotion: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  human_personal: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  collaboration_social_proof: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

interface PillarBadgeProps {
  pillar: ContentPillar | null | undefined;
  className?: string;
}

export function PillarBadge({ pillar, className }: PillarBadgeProps) {
  if (!pillar) return null;

  return (
    <span className={cn('rounded-full px-2 py-1 text-xs font-medium', PILLAR_STYLES[pillar] || 'bg-zinc-100 text-zinc-700', className)}>
      {CONTENT_PILLAR_LABELS[pillar] || pillar}
    </span>
  );
}
