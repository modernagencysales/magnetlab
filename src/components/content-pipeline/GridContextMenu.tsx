'use client';

import { useEffect, useRef } from 'react';
import { Eye, Radio, CalendarClock, Trash2 } from 'lucide-react';
import type { PipelinePost } from '@/lib/types/content-pipeline';

interface GridContextMenuProps {
  post: PipelinePost;
  x: number;
  y: number;
  onClose: () => void;
  onViewDetails: () => void;
  onBroadcast: () => void;
  onReschedule: () => void;
  onRemoveFromSchedule: () => void;
}

export function GridContextMenu({
  x,
  y,
  onClose,
  onViewDetails,
  onBroadcast,
  onReschedule,
  onRemoveFromSchedule,
}: GridContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md border border-border bg-white shadow-lg dark:bg-zinc-900"
      style={{ left: x, top: y }}
    >
      <div className="py-1">
        <button
          type="button"
          onClick={onViewDetails}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          View details
        </button>
        <button
          type="button"
          onClick={onBroadcast}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
        >
          <Radio className="h-3.5 w-3.5 text-muted-foreground" />
          Broadcast to team
        </button>
        <button
          type="button"
          onClick={onReschedule}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
        >
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          Reschedule
        </button>
        <hr className="my-1 border-border" />
        <button
          type="button"
          onClick={onRemoveFromSchedule}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove from schedule
        </button>
      </div>
    </div>
  );
}
