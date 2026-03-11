'use client';

/** Quality Check Card. Validation pass/fail with per-check details.
 *  Never imports server-only modules or NextResponse. */

// ─── Types ──────────────────────────────────────────────

interface QualityCheck {
  check: string;
  passed: boolean;
  severity: string;
  feedback?: string;
}

interface QualityCheckCardProps {
  data: { passed?: boolean; checks?: QualityCheck[]; feedback?: string } | undefined;
}

// ─── SVG Icons ──────────────────────────────────────────

function CheckResultIcon({ passed }: { passed: boolean }) {
  if (passed) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-green-500">
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
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-red-500">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckItemIcon({ passed }: { passed: boolean }) {
  if (passed) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="mt-0.5 shrink-0 text-green-500">
        <path
          d="M2.5 6l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="mt-0.5 shrink-0 text-red-500">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────

export function QualityCheckCard({ data }: QualityCheckCardProps) {
  if (!data) return null;

  return (
    <div
      className={`rounded-lg border p-3 ${data.passed ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}`}
    >
      <div className="flex items-center gap-2">
        <CheckResultIcon passed={!!data.passed} />
        <p
          className={`text-sm font-medium ${data.passed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
        >
          {data.passed ? 'Quality Check Passed' : 'Quality Check Failed'}
        </p>
      </div>
      {data.checks && (
        <ul className="mt-2 ml-6 space-y-1.5">
          {data.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <CheckItemIcon passed={c.passed} />
              <div>
                <span className={c.severity === 'critical' ? 'font-medium' : ''}>{c.check}</span>
                {c.feedback && <p className="text-muted-foreground">{c.feedback}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.feedback && <p className="mt-2 ml-6 text-xs text-muted-foreground">{data.feedback}</p>}
    </div>
  );
}
