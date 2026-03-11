'use client';

/** Deliverable Card. Preview with type, title, status, and action buttons. */

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

export function DeliverableCard({ data, onApply }: DeliverableCardProps) {
  if (!data) return null;

  const statusColors: Record<string, string> = {
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    pending_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {(data.deliverable_type || '').replace(/_/g, ' ')}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${statusColors[data.status || ''] || 'bg-muted text-muted-foreground'}`}
        >
          {(data.status || 'unknown').replace(/_/g, ' ')}
        </span>
      </div>
      {data.entity_type && (
        <p className="mt-1 text-xs text-muted-foreground">Linked: {data.entity_type}</p>
      )}
      {data.validation_result && (
        <p
          className={`mt-2 text-xs ${data.validation_result.passed ? 'text-green-600' : 'text-red-600'}`}
        >
          {data.validation_result.feedback}
        </p>
      )}
      {onApply && data.status === 'pending_review' && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onApply('approve_deliverable', data)}
            className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
          >
            Approve
          </button>
          <button
            onClick={() => onApply('edit_deliverable', data)}
            className="rounded border px-3 py-1 text-xs hover:bg-muted"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
