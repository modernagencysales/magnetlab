'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Radio,
  ChevronDown,
  Filter,
  Send,
  XCircle,
} from 'lucide-react';
import { logError } from '@/lib/utils/logger';
import { SignalLeadDetail } from './SignalLeadDetail';
import type {
  SignalLead,
  SignalLeadStatus,
  SentimentScore,
  SignalEvent,
} from '@/lib/types/signals';

// ─── Helper types for the API response ────────────────────

interface SignalLeadWithEvents extends SignalLead {
  signal_events?: SignalEvent[];
}

// ─── Score color coding ────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  if (score >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
}

// ─── Sentiment badge styling ────────────────────────────────

const SENTIMENT_STYLES: Record<SentimentScore, string> = {
  high_intent: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  question: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  medium_intent: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  low_intent: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const SENTIMENT_LABELS: Record<SentimentScore, string> = {
  high_intent: 'High Intent',
  question: 'Question',
  medium_intent: 'Medium',
  low_intent: 'Low',
};

// ─── Status badge styling ───────────────────────────────────

const STATUS_STYLES: Record<SignalLeadStatus, string> = {
  new: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  enriched: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  qualified: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  pushed: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  excluded: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

// ─── Main component ─────────────────────────────────────────

export function SignalLeadsTable() {
  const [leads, setLeads] = useState<SignalLeadWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [icpOnly, setIcpOnly] = useState(false);
  const [signalTypeFilter, setSignalTypeFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPushModal, setShowPushModal] = useState(false);
  const [campaignId, setCampaignId] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Detail drawer
  const [selectedLead, setSelectedLead] = useState<SignalLeadWithEvents | null>(null);

  // ── Fetch leads ──────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (icpOnly) {
        params.set('icp_match', 'true');
      }
      if (signalTypeFilter !== 'all') {
        params.set('signal_type', signalTypeFilter);
      }
      if (minScore > 0) {
        params.set('min_score', minScore.toString());
      }

      const response = await fetch(`/api/signals/leads?${params}`);
      if (!response.ok) throw new Error('Failed to fetch signal leads');

      const data = await response.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signal leads');
      logError('signals/table', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, icpOnly, signalTypeFilter, minScore]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, icpOnly, signalTypeFilter, minScore]);

  // ── Selection helpers ────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  // ── Bulk actions ─────────────────────────────────────────

  const handleBulkExclude = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const response = await fetch('/api/signals/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exclude',
          lead_ids: Array.from(selectedIds),
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to exclude leads');
      }
      await fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to exclude leads');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkPush = async () => {
    if (selectedIds.size === 0 || !campaignId.trim()) return;
    setBulkLoading(true);
    try {
      const response = await fetch('/api/signals/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push',
          lead_ids: Array.from(selectedIds),
          campaign_id: campaignId.trim(),
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to push leads');
      }
      setShowPushModal(false);
      setCampaignId('');
      await fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push leads');
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────

  const hasActiveFilters =
    statusFilter !== 'all' || icpOnly || signalTypeFilter !== 'all' || minScore > 0;

  const startIndex = (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, total);

  // ── Render ───────────────────────────────────────────────

  return (
    <>
      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
              showFilters || hasActiveFilters
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setShowPushModal(true)}
                disabled={bulkLoading}
                className="flex items-center gap-2 rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Push to HeyReach
              </button>
              <button
                onClick={handleBulkExclude}
                disabled={bulkLoading}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                Exclude
              </button>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 p-4">
            {/* Status */}
            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="enriched">Enriched</option>
                <option value="qualified">Qualified</option>
                <option value="pushed">Pushed</option>
                <option value="excluded">Excluded</option>
              </select>
            </div>

            {/* ICP Match */}
            <div className="min-w-[120px]">
              <label className="text-xs font-medium text-muted-foreground">ICP Match</label>
              <select
                value={icpOnly ? 'icp' : 'all'}
                onChange={(e) => setIcpOnly(e.target.value === 'icp')}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="icp">ICP Only</option>
              </select>
            </div>

            {/* Signal Type */}
            <div className="min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground">Signal Type</label>
              <select
                value={signalTypeFilter}
                onChange={(e) => setSignalTypeFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="keyword_engagement">Keyword Engagement</option>
                <option value="company_engagement">Company Engagement</option>
                <option value="profile_engagement">Profile Engagement</option>
                <option value="job_change">Job Change</option>
                <option value="content_velocity">Content Velocity</option>
                <option value="job_posting">Job Posting</option>
              </select>
            </div>

            {/* Min Score */}
            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground">
                Min Score: {minScore}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
                className="mt-2 w-full accent-violet-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Radio className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No signal leads yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Signal leads will appear here once your keyword monitors, company monitors,
            or profile monitors discover engagement.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === leads.length && leads.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded accent-violet-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Headline
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Signals
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sentiment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded accent-violet-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm whitespace-nowrap">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {lead.headline || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm whitespace-nowrap">
                        {lead.company || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {lead.country || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                        {lead.signal_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor(
                          lead.compound_score
                        )}`}
                      >
                        {lead.compound_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.sentiment_score ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            SENTIMENT_STYLES[lead.sentiment_score]
                          }`}
                        >
                          {SENTIMENT_LABELS[lead.sentiment_score]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[lead.status]
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex} to {endIndex} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-muted"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-muted"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Push to HeyReach modal */}
      {showPushModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowPushModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Push to HeyReach</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Push {selectedIds.size} selected lead{selectedIds.size !== 1 ? 's' : ''} to a
              HeyReach campaign.
            </p>
            <label className="text-xs font-medium text-muted-foreground">
              Campaign ID
            </label>
            <input
              type="text"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="Enter HeyReach campaign ID..."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleBulkPush}
                disabled={!campaignId.trim() || bulkLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
              >
                {bulkLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Push
              </button>
              <button
                onClick={() => setShowPushModal(false)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedLead && (
        <SignalLeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onExclude={async (leadId) => {
            try {
              const response = await fetch('/api/signals/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'exclude',
                  lead_ids: [leadId],
                }),
              });
              if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to exclude lead');
              }
              setSelectedLead(null);
              await fetchLeads();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to exclude lead');
            }
          }}
          onPush={async (leadId, campId) => {
            try {
              const response = await fetch('/api/signals/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'push',
                  lead_ids: [leadId],
                  campaign_id: campId,
                }),
              });
              if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to push lead');
              }
              setSelectedLead(null);
              await fetchLeads();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to push lead');
            }
          }}
        />
      )}
    </>
  );
}
