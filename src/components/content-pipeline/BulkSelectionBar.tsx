'use client';

import { PenLine, ArrowRight, Calendar, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnId } from './KanbanColumn';

interface BulkSelectionBarProps {
  count: number;
  activeColumn: ColumnId | null;
  isProcessing: boolean;
  onPrimaryAction: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const COLUMN_ACTIONS: Record<ColumnId, { label: string; icon: React.ReactNode; color: string }> = {
  ideas: {
    label: 'Write Selected',
    icon: <PenLine className="h-3.5 w-3.5" />,
    color: 'bg-green-600 hover:bg-green-700 text-white',
  },
  written: {
    label: 'Move to Review',
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    color: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  review: {
    label: 'Schedule All',
    icon: <Calendar className="h-3.5 w-3.5" />,
    color: 'bg-orange-600 hover:bg-orange-700 text-white',
  },
  scheduled: {
    label: 'Move to Review',
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    color: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
};

export function BulkSelectionBar({
  count,
  activeColumn,
  isProcessing,
  onPrimaryAction,
  onDelete,
  onClear,
}: BulkSelectionBarProps) {
  const action = activeColumn ? COLUMN_ACTIONS[activeColumn] : null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 shadow-xl">
        <span className="text-sm font-medium">{count} selected</span>

        {action && (
          <button
            onClick={onPrimaryAction}
            disabled={isProcessing}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
              action.color
            )}
          >
            {action.icon}
            {action.label}
          </button>
        )}

        <button
          onClick={onDelete}
          disabled={isProcessing}
          className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>

        <button
          onClick={onClear}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
          title="Clear selection (Esc)"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="text-[10px] text-muted-foreground">Press Esc to clear</span>
      </div>
    </div>
  );
}
