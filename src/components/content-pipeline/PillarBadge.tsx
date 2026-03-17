'use client';

import { Badge } from '@magnetlab/magnetui';
import type { ContentPillar } from '@/lib/types/content-pipeline';
import { CONTENT_PILLAR_LABELS } from '@/lib/types/content-pipeline';

const PILLAR_VARIANTS: Record<ContentPillar, 'purple' | 'blue' | 'orange' | 'green'> = {
  moments_that_matter: 'purple',
  teaching_promotion: 'blue',
  human_personal: 'orange',
  collaboration_social_proof: 'green',
};

interface PillarBadgeProps {
  pillar: ContentPillar | null | undefined;
  className?: string;
}

export function PillarBadge({ pillar, className }: PillarBadgeProps) {
  if (!pillar) return null;

  return (
    <Badge variant={PILLAR_VARIANTS[pillar] || 'gray'} className={className}>
      {CONTENT_PILLAR_LABELS[pillar] || pillar}
    </Badge>
  );
}
