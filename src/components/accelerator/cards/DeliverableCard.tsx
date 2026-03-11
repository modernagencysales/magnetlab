'use client';

/** Deliverable Card. Preview with type, status badge, validation, and action buttons.
 *  Never imports server-only modules or NextResponse. */

// ─── Types ──────────────────────────────────────────────

interface DeliverableCardProps {
  data:
    | {
        deliverable_type?: string;
        status?: string;
        entity_type?: string;
        validation_result?: { passed: boolean; feedback: string };
      }
    | undefined;
  onApply?: (type: string, data: unknown) => void;
}

// ─── Status Styling ─────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; icon: JSX.Element }> = {
  in_progress: {
    bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10" className="animate-spin">
        <circle
          cx="5"
          cy="5"
          r="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="8 12"
        />
      </svg>
    ),
  },
  pending_review: {
    bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5" cy="5" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  approved: {
    bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path
          d="M2.5 5l2 2 3.5-4"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  rejected: {
    bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M3 3l4 4M7 3l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

// ─── Component ──────────────────────────────────────────

export function DeliverableCard({ data, onApply }: DeliverableCardProps) {
  if (!data) return null;

  const style = STATUS_STYLES[data.status || ''];
  const fallbackBg = 'bg-muted text-muted-foreground';

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize">
          {(data.deliverable_type || '').replace(/_/g, ' ')}
        </span>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style?.bg || fallbackBg}`}
        >
          {style?.icon}
          {(data.status || 'unknown').replace(/_/g, ' ')}
        </span>
      </div>

      {data.entity_type && (
        <p className="mt-1 text-xs text-muted-foreground">Linked: {data.entity_type}</p>
      )}

      {data.validation_result && (
        <div
          className={`mt-2 rounded-md px-2 py-1.5 text-xs ${
            data.validation_result.passed
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {data.validation_result.feedback}
        </div>
      )}

      {onApply && data.status === 'pending_review' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onApply('approve_deliverable', data)}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
          >
            Approve
          </button>
          <button
            onClick={() => onApply('edit_deliverable', data)}
            className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            Request Changes
          </button>
        </div>
      )}
    </div>
  );
}
