'use client';

/** Quality Check Card. Validation pass/fail with per-check details. */

interface QualityCheck {
  check: string;
  passed: boolean;
  severity: string;
  feedback?: string;
}

interface QualityCheckCardProps {
  data: { passed?: boolean; checks?: QualityCheck[]; feedback?: string } | undefined;
}

export function QualityCheckCard({ data }: QualityCheckCardProps) {
  if (!data) return null;

  return (
    <div
      className={`rounded-lg border p-3 ${data.passed ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}`}
    >
      <p
        className={`text-sm font-medium ${data.passed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
      >
        {data.passed ? 'Quality Check Passed' : 'Quality Check Failed'}
      </p>
      {data.checks && (
        <ul className="mt-2 space-y-1">
          {data.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className={c.passed ? 'text-green-500' : 'text-red-500'}>
                {c.passed ? '✓' : '✗'}
              </span>
              <div>
                <span className={c.severity === 'critical' ? 'font-medium' : ''}>{c.check}</span>
                {c.feedback && <p className="text-muted-foreground">{c.feedback}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.feedback && <p className="mt-2 text-xs text-muted-foreground">{data.feedback}</p>}
    </div>
  );
}
