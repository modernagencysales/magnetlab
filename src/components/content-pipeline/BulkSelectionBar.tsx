'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';

interface BulkSelectionBarProps {
  count: number;
  onMove: (status: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

const MOVE_OPTIONS = [
  { value: 'draft', label: 'Ideas' },
  { value: 'reviewing', label: 'Written' },
  { value: 'approved', label: 'Review' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'failed', label: 'Failed' },
];

export function BulkSelectionBar({ count, onMove, onDelete, onClear }: BulkSelectionBarProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-xl border bg-background px-4 py-3 shadow-lg">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">{count} selected</span>

        <div className="relative">
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Move to...
          </button>
          {showMoveMenu && (
            <div className="absolute bottom-full left-0 mb-1 min-w-[120px] rounded-lg border bg-background py-1 shadow-lg">
              {MOVE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onMove(option.value);
                    setShowMoveMenu(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>

        <button
          onClick={onClear}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
