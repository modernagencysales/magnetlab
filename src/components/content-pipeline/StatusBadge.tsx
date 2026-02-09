'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; className: string; spinning?: boolean }> = {
  // Idea statuses
  extracted: { label: 'Extracted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  selected: { label: 'Selected', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  writing: { label: 'Writing', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300', spinning: true },
  written: { label: 'Written', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  scheduled: { label: 'Scheduled', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' },
  published: { label: 'Published', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  archived: { label: 'Archived', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  // Post statuses
  draft: { label: 'Draft', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  reviewing: { label: 'In Review', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  // Processing statuses
  processing: { label: 'Processing', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300', spinning: true },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  pending: { label: 'Pending', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' };

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', config.className, className)}>
      {config.spinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {config.label}
    </span>
  );
}
