'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logError } from '@/lib/utils/logger';
import * as funnelApi from '@/frontend/api/funnel';
import * as leadsApi from '@/frontend/api/leads';

import {
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  Loader2,
  Mail,
} from 'lucide-react';
import {
  PageContainer,
  PageTitle,
  Button,
  StatCard,
  SearchInput,
  EmptyState,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Card,
  CardContent,
  LoadingCard,
} from '@magnetlab/magnetui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@magnetlab/magnetui';

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

interface LeadsPageClientProps {
  initialLeads?: Lead[];
  initialTotal?: number;
  initialFunnels?: FunnelOption[];
}

export function LeadsPageClient({
  initialLeads = [],
  initialTotal = 0,
  initialFunnels = [],
}: LeadsPageClientProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [funnels, setFunnels] = useState<FunnelOption[]>(initialFunnels);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(initialTotal);

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

  // Skip the initial fetch when server pre-fetched the first page
  const skipInitialFetch = useRef(initialLeads.length > 0 || initialTotal > 0);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await leadsApi.listLeads({
        limit,
        offset: page * limit,
        funnelId: selectedFunnel !== 'all' ? selectedFunnel : undefined,
        qualified:
          qualifiedFilter === 'all' ? undefined : qualifiedFilter === 'qualified' ? true : false,
        search: search || undefined,
      });
      setLeads(data.leads as Lead[]);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, selectedFunnel, qualifiedFilter, search]);

  const fetchFunnels = async () => {
    try {
      const data = await funnelApi.getAllFunnels();
      const list = (data.funnels || []) as Array<{
        id: string;
        slug: string;
        optin_headline: string;
      }>;
      setFunnels(list.map((f) => ({ id: f.id, slug: f.slug, optinHeadline: f.optin_headline })));
    } catch (err) {
      logError('dashboard/leads', err, { step: 'failed_to_fetch_funnels' });
    }
  };

  // Only fetch funnels client-side if not provided by server
  useEffect(() => {
    if (initialFunnels.length === 0) {
      fetchFunnels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
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
      const { blob, filename } = await leadsApi.exportLeads({
        funnelId: selectedFunnel !== 'all' ? selectedFunnel : undefined,
        qualified:
          qualifiedFilter === 'all' ? undefined : qualifiedFilter === 'qualified' ? true : false,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const { qualifiedCount, unqualifiedCount, pendingCount } = useMemo(
    () => ({
      qualifiedCount: leads.filter((l) => l.isQualified === true).length,
      unqualifiedCount: leads.filter((l) => l.isQualified === false).length,
      pendingCount: leads.filter((l) => l.isQualified === null).length,
    }),
    [leads]
  );

  return (
    <PageContainer maxWidth="xl">
      <PageTitle
        title="Leads"
        description={`${total} total leads captured`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || leads.length === 0}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Export CSV
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Qualified"
          value={qualifiedCount}
          icon={<CheckCircle className="text-emerald-500" />}
        />
        <StatCard
          label="Not Qualified"
          value={unqualifiedCount}
          icon={<XCircle className="text-red-500" />}
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          icon={<Clock className="text-amber-500" />}
        />
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <SearchInput
            placeholder="Search by email or name..."
            value={search}
            onValueChange={setSearch}
            className="flex-1"
          />
          <Button
            variant={
              showFilters || selectedFunnel !== 'all' || qualifiedFilter !== 'all'
                ? 'default'
                : 'outline'
            }
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            <ChevronDown
              className={`h-3.5 w-3.5 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="flex gap-4 p-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Funnel</label>
                <select
                  value={selectedFunnel}
                  onChange={(e) => {
                    setSelectedFunnel(e.target.value);
                    setPage(0);
                  }}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
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
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="all">All Leads</option>
                  <option value="true">Qualified Only</option>
                  <option value="false">Not Qualified</option>
                </select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Leads Table */}
      {loading ? (
        <LoadingCard count={3} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title="No leads yet"
          description="Leads will appear here once people sign up through your funnel pages."
        />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Funnel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{lead.email}</p>
                        {lead.name && <p className="text-xs text-muted-foreground">{lead.name}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm truncate max-w-[180px]">
                          {lead.leadMagnetTitle || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">/{lead.funnelSlug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.isQualified === true && (
                        <Badge variant="green">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Qualified
                        </Badge>
                      )}
                      {lead.isQualified === false && (
                        <Badge variant="red">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Qualified
                        </Badge>
                      )}
                      {lead.isQualified === null && (
                        <Badge variant="orange">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {lead.utmSource || <span className="text-muted-foreground">Direct</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * limit >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedLead?.email}</DialogTitle>
            {selectedLead?.name && (
              <p className="text-sm text-muted-foreground">{selectedLead.name}</p>
            )}
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm">
                    {selectedLead.isQualified === true && 'Qualified'}
                    {selectedLead.isQualified === false && 'Not Qualified'}
                    {selectedLead.isQualified === null && 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Date</p>
                  <p className="mt-1 text-sm">
                    {new Date(selectedLead.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Funnel</p>
                <p className="mt-1 text-sm">{selectedLead.leadMagnetTitle || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">/{selectedLead.funnelSlug}</p>
              </div>

              {(selectedLead.utmSource || selectedLead.utmMedium || selectedLead.utmCampaign) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">UTM Parameters</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selectedLead.utmSource && (
                      <Badge variant="gray">source: {selectedLead.utmSource}</Badge>
                    )}
                    {selectedLead.utmMedium && (
                      <Badge variant="gray">medium: {selectedLead.utmMedium}</Badge>
                    )}
                    {selectedLead.utmCampaign && (
                      <Badge variant="gray">campaign: {selectedLead.utmCampaign}</Badge>
                    )}
                  </div>
                </div>
              )}

              {selectedLead.qualificationAnswers &&
                Object.keys(selectedLead.qualificationAnswers).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Qualification Answers
                    </p>
                    <div className="mt-2 space-y-2">
                      {Object.entries(selectedLead.qualificationAnswers).map(
                        ([question, answer]) => (
                          <div key={question} className="rounded-md bg-muted/50 p-2.5">
                            <p className="text-xs text-muted-foreground">{question}</p>
                            <p className="mt-0.5 text-sm font-medium capitalize">{answer}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              <div className="flex gap-2 pt-2">
                <Button asChild className="flex-1">
                  <a href={`mailto:${selectedLead.email}`}>
                    <Mail className="h-4 w-4 mr-1" />
                    Send Email
                  </a>
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setSelectedLead(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
