/**
 * StageIndicator. Horizontal 7-step qualification ladder visualization.
 * Shows all stages with the current one highlighted and previous stages completed.
 * Presentational only — no state, no API calls.
 */

import { cn } from '@/lib/utils';
import type { QualificationStage } from '@/lib/types/dm-coach';
import { QUALIFICATION_LADDER } from '@/lib/types/dm-coach';

// ─── Types ─────────────────────────────────────────────────────────

interface StageIndicatorProps {
  currentStage: QualificationStage;
}

// ─── Constants ─────────────────────────────────────────────────────

const STAGE_ORDER: QualificationStage[] = [
  'unknown',
  'situation',
  'pain',
  'impact',
  'vision',
  'capability',
  'commitment',
];

// ─── Component ─────────────────────────────────────────────────────

export function StageIndicator({ currentStage }: StageIndicatorProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((stage, index) => {
        const isCurrent = index === currentIndex;
        const isPast = index < currentIndex;
        const isFuture = index > currentIndex;
        const label = QUALIFICATION_LADDER[stage]?.label ?? stage;

        return (
          <div key={stage} className="flex items-center gap-1">
            {/* Connector line (except before first) */}
            {index > 0 && (
              <div className={cn('h-px w-3', isPast || isCurrent ? 'bg-primary' : 'bg-border')} />
            )}

            {/* Stage dot + label */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  'size-2 rounded-full transition-colors',
                  isCurrent && 'bg-primary ring-2 ring-primary/30',
                  isPast && 'bg-primary/60',
                  isFuture && 'bg-border'
                )}
              />
              <span
                className={cn(
                  'text-[9px] leading-none',
                  isCurrent && 'font-semibold text-primary',
                  isPast && 'text-muted-foreground',
                  isFuture && 'text-muted-foreground/40'
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
