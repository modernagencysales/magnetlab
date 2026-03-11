'use client';

/** Approval Card. Confirmation dialog for significant actions.
 *  Never imports server-only modules or NextResponse. */

// ─── Types ──────────────────────────────────────────────

interface ApprovalCardProps {
  data: { action?: string; description?: string; items?: string[] } | undefined;
  onApply?: (type: string, data: unknown) => void;
}

// ─── Component ──────────────────────────────────────────

export function ApprovalCard({ data, onApply }: ApprovalCardProps) {
  if (!data) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <div className="flex items-center gap-2">
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          className="shrink-0 text-amber-500"
        >
          <path
            d="M8 1L1 14h14L8 1z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
        </svg>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          Confirmation Required
        </p>
      </div>
      {data.description && (
        <p className="mt-1 ml-6 text-xs text-amber-600 dark:text-amber-400">{data.description}</p>
      )}
      {data.items && (
        <ul className="mt-2 ml-6 space-y-1">
          {data.items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"
            >
              <svg
                aria-hidden="true"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                className="mt-0.5 shrink-0"
              >
                <circle cx="5" cy="5" r="2" fill="currentColor" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      )}
      {onApply && (
        <div className="mt-3 ml-6 flex gap-2">
          <button
            onClick={() => onApply('confirm_action', data)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
          >
            Approve
          </button>
          <button
            onClick={() => onApply('edit_first', data)}
            className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
          >
            Edit First
          </button>
          <button
            onClick={() => onApply('cancel_action', data)}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
