'use client';

/** Approval Card. Confirmation dialog for significant actions. */

interface ApprovalCardProps {
  data: { action?: string; description?: string; items?: string[] } | undefined;
  onApply?: (type: string, data: unknown) => void;
}

export function ApprovalCard({ data, onApply }: ApprovalCardProps) {
  if (!data) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
        Confirmation Required
      </p>
      {data.description && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{data.description}</p>
      )}
      {data.items && (
        <ul className="mt-2 space-y-1">
          {data.items.map((item, i) => (
            <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
              • {item}
            </li>
          ))}
        </ul>
      )}
      {onApply && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onApply('confirm_action', data)}
            className="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700"
          >
            Approve
          </button>
          <button
            onClick={() => onApply('edit_first', data)}
            className="rounded border border-amber-300 px-3 py-1 text-xs hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
          >
            Edit First
          </button>
          <button
            onClick={() => onApply('cancel_action', data)}
            className="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
