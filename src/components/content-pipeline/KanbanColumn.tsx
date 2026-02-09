'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { KanbanCard, type CardItem } from './KanbanCard';

export type ColumnId = 'ideas' | 'written' | 'review' | 'scheduled';

interface ColumnConfig {
  label: string;
  headerColor: string;
  borderColor: string;
  dropHighlight: string;
}

const COLUMN_STYLES: Record<ColumnId, ColumnConfig> = {
  ideas: {
    label: 'Ideas',
    headerColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    borderColor: 'border-t-purple-400',
    dropHighlight: 'ring-purple-400 bg-purple-50 dark:bg-purple-950/20',
  },
  written: {
    label: 'Written',
    headerColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    borderColor: 'border-t-blue-400',
    dropHighlight: 'ring-blue-400 bg-blue-50 dark:bg-blue-950/20',
  },
  review: {
    label: 'Review',
    headerColor: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    borderColor: 'border-t-green-400',
    dropHighlight: 'ring-green-400 bg-green-50 dark:bg-green-950/20',
  },
  scheduled: {
    label: 'Scheduled',
    headerColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    borderColor: 'border-t-amber-400',
    dropHighlight: 'ring-amber-400 bg-amber-50 dark:bg-amber-950/20',
  },
};

interface KanbanColumnProps {
  columnId: ColumnId;
  items: CardItem[];
  selectedIds: Set<string>;
  previewId: string | null;
  draggingId: string | null;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onCardClick: (item: CardItem) => void;
  onDragStart: (e: React.DragEvent, item: CardItem) => void;
  onDrop: (columnId: ColumnId) => void;
  onCardAction: (item: CardItem, action: string) => void;
}

export function KanbanColumn({
  columnId,
  items,
  selectedIds,
  previewId,
  draggingId,
  onToggleSelect,
  onCardClick,
  onDragStart,
  onDrop,
  onCardAction,
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const config = COLUMN_STYLES[columnId];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set false if actually leaving the column (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onDrop(columnId);
  }, [columnId, onDrop]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex min-w-[260px] flex-col rounded-lg border-t-2 bg-muted/50 transition-all',
        config.borderColor,
        dragOver && `ring-2 ${config.dropHighlight}`
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', config.headerColor)}>
            {config.label}
          </span>
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {items.length}
          </span>
        </div>
        {dragOver && columnId === 'scheduled' && (
          <span className="animate-pulse text-[10px] font-medium text-amber-600 dark:text-amber-400">
            Auto-schedule
          </span>
        )}
      </div>

      {/* Card list — scrollable */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {dragOver ? 'Drop here' : 'No items'}
          </p>
        ) : (
          items.map((item) => {
            const itemId = item.data.id;
            return (
              <KanbanCard
                key={itemId}
                item={item}
                selected={selectedIds.has(itemId)}
                previewActive={previewId === itemId}
                dragging={draggingId === itemId}
                onToggleSelect={(e) => onToggleSelect(itemId, e)}
                onClick={() => onCardClick(item)}
                onDragStart={(e) => onDragStart(e, item)}
                onAction={(action) => onCardAction(item, action)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
