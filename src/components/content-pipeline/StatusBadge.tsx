'use client';

import { Loader2 } from 'lucide-react';
import { Badge } from '@magnetlab/magnetui';

type BadgeVariant = 'blue' | 'purple' | 'orange' | 'green' | 'red' | 'gray' | 'default';

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant; spinning?: boolean }> =
  {
    // Idea statuses
    extracted: { label: 'Extracted', variant: 'blue' },
    selected: { label: 'Selected', variant: 'purple' },
    writing: { label: 'Writing', variant: 'orange', spinning: true },
    written: { label: 'Written', variant: 'green' },
    scheduled: { label: 'Scheduled', variant: 'blue' },
    published: { label: 'Published', variant: 'green' },
    archived: { label: 'Archived', variant: 'gray' },
    // Post statuses
    draft: { label: 'Draft', variant: 'gray' },
    reviewing: { label: 'In Review', variant: 'orange' },
    approved: { label: 'Approved', variant: 'green' },
    failed: { label: 'Failed', variant: 'red' },
    // Processing statuses
    processing: { label: 'Processing', variant: 'orange', spinning: true },
    completed: { label: 'Completed', variant: 'green' },
    pending: { label: 'Pending', variant: 'gray' },
  };

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, variant: 'gray' as BadgeVariant };

  return (
    <Badge variant={config.variant} className={className}>
      {config.spinning && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
      {config.label}
    </Badge>
  );
}
