'use client';

/**
 * CampaignDetail. Shows campaign stats, lead table, config summary, and actions.
 * Never imports server-only modules.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Play,
  Pause,
  Eye,
  Users,
  UserCheck,
  MessageSquare,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import * as campaignsApi from '@/frontend/api/post-campaigns';
import type {
  PostCampaign,
  PostCampaignLead,
  PostCampaignLeadStatus,
  PostCampaignStatus,
} from '@/lib/types/post-campaigns';

// ─── Status badge config ────────────────────────────────

type BadgeVariant = 'green' | 'orange' | 'blue' | 'purple' | 'red' | 'gray';

const CAMPAIGN_STATUS_VARIANTS: Record<PostCampaignStatus, BadgeVariant> = {
  draft: 'gray',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
};

const LEAD_STATUS_VARIANTS: Record<PostCampaignLeadStatus, BadgeVariant> = {
  detected: 'gray',
  connection_pending: 'orange',
  connection_accepted: 'blue',
  dm_queued: 'purple',
  dm_sent: 'green',
  dm_failed: 'red',
  skipped: 'gray',
  expired: 'gray',
};

const LEAD_STATUS_LABELS: Record<PostCampaignLeadStatus, string> = {
  detected: 'Detected',
  connection_pending: 'Pending',
  connection_accepted: 'Connected',
  dm_queued: 'DM Queued',
  dm_sent: 'DM Sent',
  dm_failed: 'DM Failed',
  skipped: 'Skipped',
  expired: 'Expired',
};

// ─── Types ──────────────────────────────────────────────

interface CampaignDetailProps {
  campaignId: string;
}

// ─── Main component ─────────────────────────────────────

export function CampaignDetail({ campaignId }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<PostCampaign | null>(null);
  const [leads, setLeads] = useState<PostCampaignLead[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ detected: 0, connection_pending: 0, connection_accepted: 0, dm_sent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch campaign detail ───────────────────────────

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await campaignsApi.getCampaign(campaignId);
      setCampaign(data.campaign);
      setLeads(data.leads);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
      logError('post-campaigns/detail', err, { campaignId });
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── Actions ─────────────────────────────────────────

  const handleToggleStatus = async () => {
    if (!campaign) return;
    setActionLoading(true);
    try {
      if (campaign.status === 'active') {
        await campaignsApi.pauseCampaign(campaign.id);
      } else {
        await campaignsApi.activateCampaign(campaign.id);
      }
      await fetchDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
      logError('post-campaigns/detail/toggle', err, { campaignId });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading/Error states ────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error || 'Campaign not found'}</p>
        </div>
      </div>
    );
  }

  const canToggle = campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft';

  // ── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackLink />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{campaign.name}</h2>
              <Badge variant={CAMPAIGN_STATUS_VARIANTS[campaign.status]} className="capitalize">
                {campaign.status}
              </Badge>
            </div>
            <a
              href={campaign.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              View Post
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        {canToggle && (
          <Button
            variant={campaign.status === 'active' ? 'outline' : 'default'}
            onClick={handleToggleStatus}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : campaign.status === 'active' ? (
              <Pause className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {campaign.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Detected"
          value={stats.detected}
          icon={<Eye className="text-muted-foreground" />}
        />
        <StatCard
          label="Pending"
          value={stats.connection_pending}
          icon={<Users className="text-orange-500" />}
        />
        <StatCard
          label="Connected"
          value={stats.connection_accepted}
          icon={<UserCheck className="text-blue-500" />}
        />
        <StatCard
          label="DM Sent"
          value={stats.dm_sent}
          icon={<MessageSquare className="text-emerald-500" />}
        />
      </div>

      {/* Config summary */}
      <ConfigSummary campaign={campaign} />

      {/* Leads table */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Campaign Leads</h3>
        {leads.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No leads detected yet"
            description="Leads will appear here once the campaign starts detecting engagement on your post."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead>DM Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/post-campaigns"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to campaigns
    </Link>
  );
}

function ConfigSummary({ campaign }: { campaign: PostCampaign }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Campaign Config</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Keywords</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {campaign.keywords.length > 0 ? (
                campaign.keywords.map((kw) => (
                  <Badge key={kw} variant="default">
                    {kw}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">All comments</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Sender</p>
            <p className="mt-1">{campaign.sender_name || 'Account connected'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Auto-accept</p>
            <p className="mt-1">{campaign.auto_accept_connections ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Auto-connect</p>
            <p className="mt-1">{campaign.auto_connect_non_requesters ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Auto-like</p>
            <p className="mt-1">{campaign.auto_like_comments ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="mt-1">{new Date(campaign.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface LeadRowProps {
  lead: PostCampaignLead;
}

function LeadRow({ lead }: LeadRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium text-sm">
        {lead.name || 'Unknown'}
      </TableCell>
      <TableCell>
        {lead.linkedin_url ? (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Profile
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={LEAD_STATUS_VARIANTS[lead.status]}>
          {LEAD_STATUS_LABELS[lead.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <p className="max-w-[200px] truncate text-sm text-muted-foreground">
          {lead.comment_text || '-'}
        </p>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {new Date(lead.detected_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {lead.connection_accepted_at
          ? new Date(lead.connection_accepted_at).toLocaleDateString()
          : '-'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {lead.dm_sent_at ? new Date(lead.dm_sent_at).toLocaleDateString() : '-'}
      </TableCell>
    </TableRow>
  );
}
