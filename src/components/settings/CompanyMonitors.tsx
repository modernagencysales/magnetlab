'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff, Building2 } from 'lucide-react';
import { Button, Input } from '@magnetlab/magnetui';
import * as signalsApi from '@/frontend/api/signals';

interface MonitoredCompany {
  id: string;
  linkedin_company_url: string;
  name: string | null;
  heyreach_campaign_id: string | null;
  is_active: boolean;
  last_scanned_at: string | null;
  created_at: string;
}

export function CompanyMonitors() {
  const [companies, setCompanies] = useState<MonitoredCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newCampaignId, setNewCampaignId] = useState('');

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await signalsApi.listSignalCompanies();
      setCompanies((data.companies || []) as MonitoredCompany[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const validateUrl = (url: string): boolean => {
    return url.includes('linkedin.com/company/');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    if (!validateUrl(newUrl.trim())) {
      setError('URL must contain linkedin.com/company/');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      await signalsApi.createSignalCompany({
        linkedin_company_url: newUrl.trim(),
        heyreach_campaign_id: newCampaignId.trim() || undefined,
      });
      setNewUrl('');
      setNewCampaignId('');
      await fetchCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await signalsApi.updateSignalCompany(id, { is_active: !isActive });
      await fetchCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this company? Historical data will remain.')) return;
    try {
      await signalsApi.deleteSignalCompany(id);
      await fetchCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const extractCompanySlug = (url: string): string => {
    const match = url.match(/linkedin\.com\/company\/([^/]+)/);
    return match ? match[1] : url;
  };

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <Building2 className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="font-medium">Company Monitors</p>
            <p className="text-xs text-muted-foreground">
              Watch LinkedIn company pages for signals ({companies.length}/10)
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {/* Company list */}
          {companies.length > 0 && (
            <div className="space-y-2 mb-4">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    !company.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {company.name || extractCompanySlug(company.linkedin_company_url)}
                    </p>
                    {company.heyreach_campaign_id && (
                      <p className="text-xs text-muted-foreground truncate">
                        Campaign: {company.heyreach_campaign_id}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Last scanned: {formatTimeAgo(company.last_scanned_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggle(company.id, company.is_active)}
                      title={company.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                    >
                      {company.is_active ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(company.id)}
                      title="Remove company"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {companies.length < 10 && (
            <form onSubmit={handleAdd} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="LinkedIn company page URL"
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={adding || !newUrl.trim()}>
                  {adding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add
                </Button>
              </div>
              <Input
                type="text"
                value={newCampaignId}
                onChange={(e) => setNewCampaignId(e.target.value)}
                placeholder="HeyReach campaign ID (optional)"
              />
            </form>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
