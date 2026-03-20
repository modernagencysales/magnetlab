/**
 * ReasoningPanel. Displays CoachReasoning breakdown — always visible, not collapsed.
 * Sections: style match, stage transition, signals, strategy, goal alignment, negative signals.
 * Presentational only — no state, no API calls.
 */

import { Badge } from '@magnetlab/magnetui';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoachReasoning, QualificationStage } from '@/lib/types/dm-coach';
import { QUALIFICATION_LADDER } from '@/lib/types/dm-coach';

// ─── Types ─────────────────────────────────────────────────────────

interface ReasoningPanelProps {
  reasoning: CoachReasoning;
  stageBefore: string;
  stageAfter: string;
}

// ─── Stage Badge Colors ────────────────────────────────────────────

const STAGE_BADGE_CLASS: Record<string, string> = {
  unknown: 'bg-muted text-muted-foreground',
  situation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pain: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  impact: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  vision: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  capability: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  commitment: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

// ─── Component ─────────────────────────────────────────────────────

export function ReasoningPanel({ reasoning, stageBefore, stageAfter }: ReasoningPanelProps) {
  const beforeLabel = QUALIFICATION_LADDER[stageBefore as QualificationStage]?.label ?? stageBefore;
  const afterLabel = QUALIFICATION_LADDER[stageAfter as QualificationStage]?.label ?? stageAfter;
  const stageChanged = stageBefore !== stageAfter;

  return (
    <div className="space-y-3 text-sm">
      {/* Style Match */}
      <Section label="Style Match">
        <p className="text-muted-foreground">{reasoning.styleNotes}</p>
      </Section>

      {/* Stage Transition */}
      <Section label="Stage">
        <div className="flex items-center gap-2">
          <StageBadge stage={stageBefore} label={beforeLabel} />
          {stageChanged && (
            <>
              <span className="text-xs text-muted-foreground">-&gt;</span>
              <StageBadge stage={stageAfter} label={afterLabel} />
            </>
          )}
          {!stageChanged && <span className="text-xs text-muted-foreground">(no change)</span>}
        </div>
      </Section>

      {/* Signals */}
      {reasoning.signals.length > 0 && (
        <Section label="Signals">
          <div className="flex flex-wrap gap-1">
            {reasoning.signals.map((signal, i) => (
              <Badge key={i} variant="blue" className="text-xs">
                {signal}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Strategy */}
      <Section label="Strategy">
        <p className="text-muted-foreground">{reasoning.strategyApplied}</p>
      </Section>

      {/* Goal Alignment */}
      <Section label="Goal Alignment">
        <p className="text-muted-foreground">{reasoning.goalAlignment}</p>
      </Section>

      {/* Negative Signals */}
      {reasoning.negativeSignals && reasoning.negativeSignals.length > 0 && (
        <Section label="Negative Signals">
          <div className="flex flex-wrap gap-1">
            {reasoning.negativeSignals.map((signal, i) => (
              <Badge key={i} variant="red" className="text-xs">
                <AlertTriangle className="mr-1 size-3" />
                {signal}
              </Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      {children}
    </div>
  );
}

function StageBadge({ stage, label }: { stage: string; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        STAGE_BADGE_CLASS[stage] ?? STAGE_BADGE_CLASS.unknown
      )}
    >
      {label}
    </span>
  );
}
