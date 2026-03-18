'use client';

/**
 * CampaignList. Paginated table of post campaigns with status filter, toggle, and delete.
 * Never imports server-only modules.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Filter,
  ChevronDown,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Megaphone,
} from 'lucide-react';
import {
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  ConfirmDialog,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import * as campaignsApi from '@/frontend/api/post-campaigns';
import type { PostCampaign, PostCampaignStatus } from '@/lib/types/post-campaigns';

// ─── Status badge config ────────────────────────────────

type BadgeVariant = 'green' | 'orange' | 'blue' | 'purple' | 'red' | 'gray';

const STATUS_VARIANTS: Record<PostCampaignStatus, BadgeVariant> = {
  draft: 'gray',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
};

const STATUS_LABELS: Record<PostCampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

// ─── Helpers ────────────────────────────────────────────

function truncateUrl(url: string, maxLength = 40): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength) + '...';
}

// ─── Main component ─────────────────────────────────────

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<PostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 25;

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<PostCampaign | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Action loading
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ── Fetch campaigns ─────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await campaignsApi.listCampaigns({
        status: statusFilter !== 'all' ? (statusFilter as PostCampaignStatus) : undefined,
        page,
        limit,
      });
      setCampaigns(data.campaigns);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      logError('post-campaigns/list', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ── Actions ─────────────────────────────────────────

  const handleToggleStatus = async (campaign: PostCampaign) => {
    setActionLoadingId(campaign.id);
    try {
      if (campaign.status === 'active') {
        await campaignsApi.pauseCampaign(campaign.id);
      } else {
        await campaignsApi.activateCampaign(campaign.id);
      }
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
      logError('post-campaigns/toggle', err, { campaignId: campaign.id });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await campaignsApi.deleteCampaign(deleteTarget.id);
      setDeleteTarget(null);
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
      logError('post-campaigns/delete', err, { campaignId: deleteTarget.id });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Derived ─────────────────────────────────────────

  const hasActiveFilter = statusFilter !== 'all';
  const startIndex = (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, total);

  // ── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={showFilters || hasActiveFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={
              showFilters || hasActiveFilter
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : ''
            }
          >
            <Filter className="mr-1.5 h-4 w-4" />
            Filters
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-12 w-12" />}
          title="No post campaigns yet"
          description="Create a post campaign to automatically engage with people who comment on your LinkedIn posts."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Post URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Detected</TableHead>
                  <TableHead className="text-right">Connected</TableHead>
                  <TableHead className="text-right">DM'd</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    actionLoading={actionLoadingId === campaign.id}
                    onToggleStatus={() => handleToggleStatus(campaign)}
                    onDelete={() => setDeleteTarget(campaign)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex} to {endIndex} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}

// ─── Row sub-component ──────────────────────────────────

interface CampaignRowProps {
  campaign: PostCampaign;
  actionLoading: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function CampaignRow({ campaign, actionLoading, onToggleStatus, onDelete }: CampaignRowProps) {
  const canToggle = campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft';

  return (
    <TableRow className="cursor-pointer transition-colors hover:bg-muted/50">
      <TableCell>
        <Link
          href={`/post-campaigns/${campaign.id}`}
          className="font-medium text-sm hover:underline"
        >
          {campaign.name}
        </Link>
      </TableCell>
      <TableCell>
        <a
          href={campaign.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {truncateUrl(campaign.post_url)}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[campaign.status]}>
          {STATUS_LABELS[campaign.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {campaign.stats?.detected ?? 0}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {campaign.stats?.connection_accepted ?? (campaign.stats as Record<string, number>)?.connected ?? 0}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {campaign.stats?.dm_sent ?? 0}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canToggle && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleStatus}
              disabled={actionLoading}
              title={campaign.status === 'active' ? 'Pause' : 'Activate'}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : campaign.status === 'active' ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
