'use client';

/** Outreach campaign detail — stats, actions, lead management. */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Skeleton,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import { useOutreachCampaign, useOutreachCampaignLeads } from '@/frontend/hooks/api/useOutreachCampaigns';
import * as outreachCampaignsApi from '@/frontend/api/outreach-campaigns';
import { LeadTable } from './LeadTable';
import { AddLeadsModal } from './AddLeadsModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutreachCampaignDetailProps {
  campaignId: string;
}

// ─── Status badge config ──────────────────────────────────────────────────────

type BadgeVariant = 'outline' | 'default' | 'blue' | 'green' | 'red' | 'orange' | 'gray';

// Matches CampaignsList: active=green, completed=blue
const CAMPAIGN_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'gray',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
};

const PRESET_LABELS: Record<string, string> = {
  warm_connect: 'Warm Connect',
  direct_connect: 'Direct Connect',
  nurture: 'Nurture',
};

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OutreachCampaignDetail({ campaignId }: OutreachCampaignDetailProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { campaign, isLoading, mutate: mutateCampaign } = useOutreachCampaign(campaignId);
  const {
    leads,
    isLoading: leadsLoading,
    mutate: mutateLeads,
  } = useOutreachCampaignLeads(campaignId, statusFilter || undefined);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleActivate = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      await outreachCampaignsApi.activateCampaign(campaignId);
      await mutateCampaign();
    } catch (err) {
      logError('OutreachCampaignDetail/activate', err);
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      await outreachCampaignsApi.pauseCampaign(campaignId);
      await mutateCampaign();
    } catch (err) {
      logError('OutreachCampaignDetail/pause', err);
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await outreachCampaignsApi.deleteCampaign(campaignId);
      router.push('/campaigns');
    } catch (err) {
      logError('OutreachCampaignDetail/delete', err);
      setActionError(err instanceof Error ? err.message : 'Action failed');
      setActionLoading(false);
    }
  };

  const handleSkipLead = async (leadId: string) => {
    setActionError(null);
    try {
      await outreachCampaignsApi.skipLead(campaignId, leadId);
      await mutateLeads();
    } catch (err) {
      logError('OutreachCampaignDetail/skipLead', err);
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) return <DetailSkeleton />;

  if (!campaign) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">Campaign not found.</p>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const { stats, progress } = campaign;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">{PRESET_LABELS[campaign.preset] ?? campaign.preset}</Badge>
              <Badge variant={CAMPAIGN_STATUS_VARIANTS[campaign.status] ?? 'gray'}>
                {campaign.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <Button onClick={handleActivate} disabled={actionLoading} size="sm">
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Activate
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button variant="outline" onClick={handlePause} disabled={actionLoading} size="sm">
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pause
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={actionLoading} size="sm">
            Delete
          </Button>
        </div>
      </div>

      {/* ── Action error ───────────────────────────────────────────────── */}
      {actionError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="In Progress" value={stats.pending + stats.active} />
        <StatCard label="Connected" value={progress.connected} />
        <StatCard label="Replied" value={stats.replied} />
        <StatCard label="Failed / Withdrawn" value={stats.failed + stats.withdrawn} />
      </div>

      {/* ── Lead section ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leads</h2>
          <Button size="sm" onClick={() => setAddLeadsOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Leads
          </Button>
        </div>

        {leadsLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : (
          <LeadTable
            leads={leads}
            onSkip={handleSkipLead}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
          />
        )}
      </div>

      {/* ── Add Leads Modal ───────────────────────────────────────────── */}
      <AddLeadsModal
        campaignId={campaignId}
        open={addLeadsOpen}
        onOpenChange={setAddLeadsOpen}
        onAdded={() => mutateLeads()}
      />
    </div>
  );
}
