'use client';

/** Task Board Card. Renders a checklist of module steps with live status.
 *  Never imports server-only modules or NextResponse. */

// ─── Types ──────────────────────────────────────────────

interface TaskStep {
  step: string;
  status: 'complete' | 'active' | 'pending';
}

interface TaskBoardCardProps {
  data: { steps?: TaskStep[]; module?: string } | undefined;
}

// ─── Step Icons ─────────────────────────────────────────

function StepIcon({ status }: { status: TaskStep['status'] }) {
  if (status === 'complete') {
    return (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        className="shrink-0 text-green-500"
      >
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
  }
  if (status === 'active') {
    return (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        className="shrink-0 text-blue-500"
      >
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="3" fill="currentColor" className="animate-pulse" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className="shrink-0 text-muted-foreground/40"
    >
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────

export function TaskBoardCard({ data }: TaskBoardCardProps) {
  const steps = (data?.steps || []) as TaskStep[];
  const completedCount = steps.filter((s) => s.status === 'complete').length;

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      {data?.module && (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {data.module}
          </p>
          {steps.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{steps.length}
            </span>
          )}
        </div>
      )}
      {/* Progress bar */}
      {steps.length > 0 && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      )}
      <ul className="space-y-1.5">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 rounded px-1.5 py-1 ${
              s.status === 'active' ? 'bg-blue-500/5' : ''
            }`}
          >
            <StepIcon status={s.status} />
            <span
              className={`leading-tight ${
                s.status === 'complete'
                  ? 'text-muted-foreground line-through'
                  : s.status === 'active'
                    ? 'font-medium'
                    : ''
              }`}
            >
              {s.step}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
