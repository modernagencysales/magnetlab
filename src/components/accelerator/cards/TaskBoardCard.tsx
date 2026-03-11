'use client';

/** Task Board Card. Renders a checklist of module steps with live status. */

interface TaskStep {
  step: string;
  status: 'complete' | 'active' | 'pending';
}

interface TaskBoardCardProps {
  data: { steps?: TaskStep[]; module?: string } | undefined;
}

export function TaskBoardCard({ data }: TaskBoardCardProps) {
  const steps = (data?.steps || []) as TaskStep[];
  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      {data?.module && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {data.module}
        </p>
      )}
      <ul className="space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={
                s.status === 'complete'
                  ? 'text-green-500'
                  : s.status === 'active'
                    ? 'text-blue-500'
                    : 'text-muted-foreground'
              }
            >
              {s.status === 'complete' ? '✓' : s.status === 'active' ? '▸' : '○'}
            </span>
            <span className={s.status === 'active' ? 'font-medium' : ''}>{s.step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
