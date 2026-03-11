'use client';

/** Progress Panel. Sidebar showing module progress, deliverables, and review queue.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { useState } from 'react';
import type {
  ProgramState,
  ProgramModule,
  ProgramDeliverable,
  ModuleId,
} from '@/lib/types/accelerator';
import { MODULE_NAMES } from '@/lib/types/accelerator';

// ─── Status SVG Icons ───────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  const size = 16;
  switch (status) {
    case 'completed':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="text-green-500">
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M5 8l2 2 4-4"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'active':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="text-blue-500">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="4" fill="currentColor" className="animate-pulse" />
        </svg>
      );
    case 'blocked':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="text-red-400">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5.5 5.5l5 5M10.5 5.5l-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'skipped':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="text-muted-foreground/50">
          <circle
            cx="8"
            cy="8"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        </svg>
      );
    default: // not_started
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className="text-muted-foreground/40">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  not_started: 'text-muted-foreground',
  in_progress: 'text-blue-500',
  pending_review: 'text-yellow-500',
  approved: 'text-green-500',
  rejected: 'text-red-500',
};

// ─── Component ───────────────────────────────────────────

interface ProgressPanelProps {
  programState: ProgramState | null;
  onModuleClick?: (moduleId: ModuleId) => void;
}

export default function ProgressPanel({ programState, onModuleClick }: ProgressPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!programState) {
    return (
      <aside className="flex w-80 flex-col border-l bg-muted/30 p-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <svg width="32" height="32" viewBox="0 0 16 16" className="text-muted-foreground/30">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading your program...</p>
          <p className="text-xs text-muted-foreground/60">Start a conversation to begin</p>
        </div>
      </aside>
    );
  }

  const { modules, deliverables, reviewQueue } = programState;

  return (
    <aside
      className={`flex flex-col border-l bg-muted/30 transition-all ${collapsed ? 'w-12' : 'w-80'}`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-b text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={collapsed ? 'Expand progress panel' : 'Collapse progress panel'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
        >
          <path
            d="M9 3L5 7l4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {collapsed ? null : (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Module Map */}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Modules
          </h3>
          <ul className="space-y-1">
            {modules.map((mod) => (
              <ModuleRow
                key={mod.id}
                module={mod}
                deliverables={deliverables.filter((d) => d.module_id === mod.module_id)}
                onClick={() => onModuleClick?.(mod.module_id as ModuleId)}
              />
            ))}
          </ul>

          {/* Review Queue */}
          {reviewQueue.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-yellow-600">
                Needs Review ({reviewQueue.length})
              </h3>
              <ul className="space-y-2">
                {reviewQueue.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs dark:border-yellow-800 dark:bg-yellow-950"
                  >
                    <span className="font-medium">{d.deliverable_type.replace(/_/g, ' ')}</span>
                    <span className="ml-1 text-muted-foreground">
                      ({MODULE_NAMES[d.module_id as ModuleId]})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deliverables Summary */}
          <div className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deliverables
            </h3>
            {deliverables.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Deliverables will appear here as you work through modules.
              </p>
            ) : (
              <ul className="space-y-1">
                {deliverables.slice(0, 10).map((d) => (
                  <DeliverableRow key={d.id} deliverable={d} />
                ))}
                {deliverables.length > 10 && (
                  <li className="text-xs text-muted-foreground">
                    +{deliverables.length - 10} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── Sub-Components ──────────────────────────────────────

function ModuleRow({
  module: mod,
  deliverables,
  onClick,
}: {
  module: ProgramModule;
  deliverables: ProgramDeliverable[];
  onClick: () => void;
}) {
  const isActive = mod.status === 'active';
  const approvedCount = deliverables.filter((d) => d.status === 'approved').length;
  const totalCount = deliverables.length;
  const progressPct = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
          isActive ? 'bg-muted/80 font-medium ring-1 ring-blue-500/20' : ''
        }`}
      >
        <StatusIcon status={mod.status} />
        <span className="flex-1 truncate">{MODULE_NAMES[mod.module_id as ModuleId]}</span>
        {totalCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={approvedCount === totalCount ? 'text-green-500' : ''}>
              {approvedCount}/{totalCount}
            </span>
          </span>
        )}
      </button>
      {/* Mini progress bar for modules with deliverables */}
      {totalCount > 0 && progressPct > 0 && progressPct < 100 && (
        <div className="ml-7 mr-2 mt-0.5 h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
      {isActive && mod.current_step && (
        <p className="ml-7 mt-0.5 text-xs text-muted-foreground">{mod.current_step}</p>
      )}
    </li>
  );
}

function DeliverableRow({ deliverable }: { deliverable: ProgramDeliverable }) {
  const colorClass = DELIVERABLE_STATUS_COLORS[deliverable.status] || 'text-muted-foreground';
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className={`${colorClass} font-medium`}>
        {deliverable.status === 'approved' ? '✓' : deliverable.status === 'rejected' ? '✗' : '•'}
      </span>
      <span className="flex-1 truncate">{deliverable.deliverable_type.replace(/_/g, ' ')}</span>
      <span className="text-muted-foreground">
        {MODULE_NAMES[deliverable.module_id as ModuleId]?.split(' ')[0]}
      </span>
    </li>
  );
}
