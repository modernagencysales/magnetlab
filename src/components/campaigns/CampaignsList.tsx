'use client';

/**
 * CampaignsList. Merges outreach + post campaigns into one unified table.
 * Never imports server-only modules.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import {
  Badge,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@magnetlab/magnetui';
import { useOutreachCampaigns } from '@/frontend/hooks/api/useOutreachCampaigns';
import { useCampaigns } from '@/frontend/hooks/api/usePostCampaigns';
import type { OutreachCampaignStatus, OutreachPreset } from '@/lib/types/outreach-campaigns';
import type { PostCampaignStatus } from '@/lib/types/post-campaigns';

// ─── Unified row type ────────────────────────────────────────────────────────

type CampaignType = 'outreach' | 'post';

interface UnifiedCampaign {
  id: string;
  name: string;
  type: CampaignType;
  status: OutreachCampaignStatus | PostCampaignStatus;
  details: string;
  leadCount: number | null;
  createdAt: string;
  href: string;
}

// ─── Badge variant maps ──────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'green' | 'orange' | 'blue' | 'purple' | 'gray' | 'outline' | 'red';

const TYPE_VARIANTS: Record<CampaignType, BadgeVariant> = {
  outreach: 'blue',
  post: 'purple',
};

const TYPE_LABELS: Record<CampaignType, string> = {
  outreach: 'Outreach',
  post: 'Post',
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'gray',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPreset(preset: OutreachPreset): string {
  return preset
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignsList() {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { campaigns: outreachCampaigns, isLoading: outreachLoading } = useOutreachCampaigns();
  const { campaigns: postCampaigns, isLoading: postLoading } = useCampaigns();

  const isLoading = outreachLoading || postLoading;

  // ── Merge + sort ─────────────────────────────────────────────────────────

  const unified = useMemo<UnifiedCampaign[]>(() => {
    const outreach: UnifiedCampaign[] = outreachCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'outreach' as const,
      status: c.status,
      details: formatPreset(c.preset),
      leadCount: null,
      createdAt: c.created_at,
      href: `/campaigns/${c.id}`,
    }));

    const post: UnifiedCampaign[] = postCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'post' as const,
      status: c.status,
      details: '', // keywords not available in summary; populated from detail view
      leadCount: c.stats?.detected ?? c.leadsDetected ?? 0,
      createdAt: c.createdAt,
      href: `/post-campaigns/${c.id}`,
    }));

    return [...outreach, ...post].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [outreachCampaigns, postCampaigns]);

  // ── Filtered ─────────────────────────────────────────────────────────────

  const filtered = useMemo<UnifiedCampaign[]>(() => {
    return unified.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [unified, typeFilter, statusFilter]);

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from<undefined>({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="outreach">Outreach</SelectItem>
            <SelectItem value="post">Post</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-12 w-12" />}
          title="No campaigns yet"
          description="Create your first outreach campaign."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign) => (
                <TableRow
                  key={`${campaign.type}-${campaign.id}`}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => router.push(campaign.href)}
                >
                  <TableCell>
                    <span className="font-medium text-sm">{campaign.name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANTS[campaign.type]}>
                      {TYPE_LABELS[campaign.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {campaign.details || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[campaign.status] ?? 'gray'}>
                      {STATUS_LABELS[campaign.status] ?? campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.leadCount ?? '—'}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {timeAgo(campaign.createdAt)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
