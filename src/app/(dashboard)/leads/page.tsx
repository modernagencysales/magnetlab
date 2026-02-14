'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { logError } from '@/lib/utils/logger';

import {
  Users,
  Download,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  Loader2,
  Mail,
} from 'lucide-react';

interface Lead {
  id: string;
  email: string;
  name: string | null;
  isQualified: boolean | null;
  qualificationAnswers: Record<string, string> | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  funnelSlug: string | null;
  funnelHeadline: string | null;
  leadMagnetTitle: string | null;
}

interface FunnelOption {
  id: string;
  slug: string;
  optinHeadline: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedFunnel, setSelectedFunnel] = useState<string>('all');
  const [qualifiedFilter, setQualifiedFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 25;

  // Selected lead for detail view
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('offset', (page * limit).toString());

      if (selectedFunnel !== 'all') {
        params.set('funnelId', selectedFunnel);
      }
      if (qualifiedFilter !== 'all') {
        params.set('qualified', qualifiedFilter);
      }
      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/leads?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leads');

      const data = await response.json();
      setLeads(data.leads);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, selectedFunnel, qualifiedFilter, search]);

  const fetchFunnels = async () => {
    try {
      const response = await fetch('/api/funnel/all');
      if (response.ok) {
        const data = await response.json();
        setFunnels(data.funnels?.map((f: { id: string; slug: string; optin_headline: string }) => ({
          id: f.id,
          slug: f.slug,
          optinHeadline: f.optin_headline,
        })) || []);
      }
    } catch (err) {
      logError('dashboard/leads', err, { step: 'failed_to_fetch_funnels' });
    }
  };

  useEffect(() => {
    fetchFunnels();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedFunnel !== 'all') {
        params.set('funnelId', selectedFunnel);
      }
      if (qualifiedFilter !== 'all') {
        params.set('qualified', qualifiedFilter);
      }

      const response = await fetch(`/api/leads/export?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Memoize stats calculations to avoid recomputing on every render
  const { qualifiedCount, unqualifiedCount, pendingCount } = useMemo(() => ({
    qualifiedCount: leads.filter(l => l.isQualified === true).length,
    unqualifiedCount: leads.filter(l => l.isQualified === false).length,
    pendingCount: leads.filter(l => l.isQualified === null).length,
  }), [leads]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Leads
          </h1>
          <p className="text-muted-foreground">
            {total} total leads captured
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || leads.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Qualified</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{qualifiedCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Not Qualified</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{unqualifiedCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{pendingCount}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
              showFilters || selectedFunnel !== 'all' || qualifiedFilter !== 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Funnel</label>
              <select
                value={selectedFunnel}
                onChange={(e) => {
                  setSelectedFunnel(e.target.value);
                  setPage(0);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Funnels</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.optinHeadline || f.slug}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Qualification</label>
              <select
                value={qualifiedFilter}
                onChange={(e) => {
                  setQualifiedFilter(e.target.value);
                  setPage(0);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Leads</option>
                <option value="true">Qualified Only</option>
                <option value="false">Not Qualified</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Leads Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No leads yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Leads will appear here once people sign up through your funnel pages.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Funnel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Source
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
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{lead.email}</p>
                        {lead.name && (
                          <p className="text-sm text-muted-foreground">{lead.name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="truncate max-w-[200px]">{lead.leadMagnetTitle || 'Unknown'}</p>
                        <p className="text-muted-foreground">/{lead.funnelSlug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.isQualified === true && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle className="h-3 w-3" />
                          Qualified
                        </span>
                      )}
                      {lead.isQualified === false && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                          <XCircle className="h-3 w-3" />
                          Not Qualified
                        </span>
                      )}
                      {lead.isQualified === null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.utmSource ? (
                        <span className="text-sm">{lead.utmSource}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Direct</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
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
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedLead(null)}>
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedLead.email}</h3>
                {selectedLead.name && (
                  <p className="text-muted-foreground">{selectedLead.name}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <p className="mt-1">
                    {selectedLead.isQualified === true && 'Qualified'}
                    {selectedLead.isQualified === false && 'Not Qualified'}
                    {selectedLead.isQualified === null && 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Date</p>
                  <p className="mt-1">{new Date(selectedLead.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Funnel</p>
                <p className="mt-1">{selectedLead.leadMagnetTitle || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">/{selectedLead.funnelSlug}</p>
              </div>

              {(selectedLead.utmSource || selectedLead.utmMedium || selectedLead.utmCampaign) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">UTM Parameters</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedLead.utmSource && (
                      <span className="rounded bg-muted px-2 py-1 text-xs">
                        source: {selectedLead.utmSource}
                      </span>
                    )}
                    {selectedLead.utmMedium && (
                      <span className="rounded bg-muted px-2 py-1 text-xs">
                        medium: {selectedLead.utmMedium}
                      </span>
                    )}
                    {selectedLead.utmCampaign && (
                      <span className="rounded bg-muted px-2 py-1 text-xs">
                        campaign: {selectedLead.utmCampaign}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedLead.qualificationAnswers && Object.keys(selectedLead.qualificationAnswers).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Qualification Answers</p>
                  <div className="mt-2 space-y-2">
                    {Object.entries(selectedLead.qualificationAnswers).map(([question, answer]) => (
                      <div key={question} className="rounded-lg bg-muted/50 p-3">
                        <p className="text-sm">{question}</p>
                        <p className="mt-1 font-medium capitalize">{answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Mail className="h-4 w-4" />
                  Send Email
                </a>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
