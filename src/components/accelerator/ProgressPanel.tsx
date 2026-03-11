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

// ─── Status Icons ────────────────────────────────────────

const MODULE_STATUS_ICONS: Record<string, string> = {
  not_started: '○',
  active: '◐',
  blocked: '⊘',
  completed: '●',
  skipped: '◌',
};

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
      <aside className="flex w-80 flex-col border-l bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">No program data available.</p>
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
        className="flex h-10 items-center justify-center border-b text-xs text-muted-foreground hover:text-foreground"
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {collapsed ? '→' : '←'}
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
              <p className="text-xs text-muted-foreground">No deliverables yet.</p>
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
  const icon = MODULE_STATUS_ICONS[mod.status] || '○';
  const isActive = mod.status === 'active';
  const approvedCount = deliverables.filter((d) => d.status === 'approved').length;

  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
          isActive ? 'bg-muted font-medium' : ''
        }`}
      >
        <span className="text-base">{icon}</span>
        <span className="flex-1 truncate">{MODULE_NAMES[mod.module_id as ModuleId]}</span>
        {approvedCount > 0 && <span className="text-xs text-green-500">{approvedCount}✓</span>}
      </button>
      {isActive && mod.current_step && (
        <p className="ml-8 text-xs text-muted-foreground">{mod.current_step}</p>
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
