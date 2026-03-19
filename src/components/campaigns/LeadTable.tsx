'use client';

/** Lead table for outreach campaigns. Shows status, progress step, and skip action. */

import { X } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@magnetlab/magnetui';
import type { OutreachLeadSummary } from '@/frontend/api/outreach-campaigns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadTableProps {
  leads: OutreachLeadSummary[];
  onSkip: (leadId: string) => void;
  statusFilter: string;
  onStatusFilter: (s: string) => void;
}

// ─── Step derivation ──────────────────────────────────────────────────────────

function getStepLabel(lead: OutreachLeadSummary): string {
  if (lead.follow_up_sent_at) return 'Followed up';
  if (lead.messaged_at) return 'Messaged';
  if (lead.connected_at) return 'Connected';
  if (lead.connect_sent_at) return 'Connect sent';
  if (lead.viewed_at) return 'Viewed';
  return 'Pending';
}

// ─── Status badge config ──────────────────────────────────────────────────────

const SKIPPABLE_STATUSES = new Set(['pending', 'active']);

type BadgeVariant = 'outline' | 'default' | 'blue' | 'green' | 'red' | 'orange' | 'gray';

type StatusConfig = {
  variant: BadgeVariant;
  className?: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: { variant: 'outline' },
  active: { variant: 'blue' },
  completed: { variant: 'green' },
  replied: { variant: 'green', className: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400' },
  withdrawn: { variant: 'orange' },
  failed: { variant: 'red' },
  skipped: { variant: 'gray' },
};

// ─── Filter options ───────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'replied', label: 'Replied' },
  { value: 'completed', label: 'Completed' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadTable({ leads, onSkip, statusFilter, onStatusFilter }: LeadTableProps) {
  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={onStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Step</TableHead>
            <TableHead>Error</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No leads found.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => {
              const config = STATUS_CONFIG[lead.status] ?? { variant: 'outline' as BadgeVariant };
              const canSkip = SKIPPABLE_STATUSES.has(lead.status);
              const displayName = lead.name ?? lead.linkedin_username ?? lead.linkedin_url;

              return (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{displayName}</TableCell>
                  <TableCell>{lead.company ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={config.variant} className={config.className}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getStepLabel(lead)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-destructive">
                    {lead.error ?? ''}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canSkip}
                      onClick={() => onSkip(lead.id)}
                      title="Skip lead"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
