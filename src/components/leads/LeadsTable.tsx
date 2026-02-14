'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, ChevronLeft, ChevronRight, Filter, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { FunnelLead } from '@/lib/types/funnel';

import { logError } from '@/lib/utils/logger';

interface LeadsTableProps {
  funnelId?: string;
  leadMagnetId?: string;
}

export function LeadsTable({ funnelId, leadMagnetId }: LeadsTableProps) {
  const [leads, setLeads] = useState<FunnelLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<'all' | 'qualified' | 'not-qualified'>('all');
  const limit = 20;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      if (funnelId) params.set('funnelId', funnelId);
      if (leadMagnetId) params.set('leadMagnetId', leadMagnetId);
      if (filter === 'qualified') params.set('qualified', 'true');
      if (filter === 'not-qualified') params.set('qualified', 'false');

      const response = await fetch(`/api/leads?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leads');

      const data = await response.json();
      setLeads(data.leads);
      setTotal(data.total);
    } catch (err) {
      logError('leads/table', err, { step: 'fetch_leads_error' });
    } finally {
      setLoading(false);
    }
  }, [funnelId, leadMagnetId, filter, offset]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (funnelId) params.set('funnelId', funnelId);
    if (leadMagnetId) params.set('leadMagnetId', leadMagnetId);
    if (filter === 'qualified') params.set('qualified', 'true');
    if (filter === 'not-qualified') params.set('qualified', 'false');

    window.location.href = `/api/leads/export?${params}`;
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setOffset(0);
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Leads</option>
            <option value="qualified">Qualified</option>
            <option value="not-qualified">Not Qualified</option>
          </select>
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'lead' : 'leads'}
          </span>
        </div>

        <button
          onClick={handleExport}
          disabled={leads.length === 0}
          className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No leads yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Qualified
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      {lead.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {lead.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {lead.isQualified === null ? (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      ) : lead.isQualified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500">
                          <XCircle className="h-3 w-3" />
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {lead.utmSource || lead.utmMedium || lead.utmCampaign
                        ? [lead.utmSource, lead.utmMedium, lead.utmCampaign]
                            .filter(Boolean)
                            .join(' / ')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="p-2 rounded-lg border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="p-2 rounded-lg border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
