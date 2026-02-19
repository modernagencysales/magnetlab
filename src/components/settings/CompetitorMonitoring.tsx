'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff, Users } from 'lucide-react';

interface Competitor {
  id: string;
  linkedin_profile_url: string;
  name: string | null;
  headline: string | null;
  heyreach_campaign_id: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
  total_engagers: number;
  created_at: string;
}

export function CompetitorMonitoring() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newCampaignId, setNewCampaignId] = useState('');

  const fetchCompetitors = useCallback(async () => {
    try {
      const res = await fetch('/api/competitors');
      if (!res.ok) throw new Error('Failed to load competitors');
      const data = await res.json();
      setCompetitors(data.competitors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedinProfileUrl: newUrl.trim(),
          heyreachCampaignId: newCampaignId.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add competitor');
      }

      setNewUrl('');
      setNewCampaignId('');
      await fetchCompetitors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchCompetitors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this competitor? Their engagement data will remain.')) return;
    try {
      const res = await fetch(`/api/competitors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchCompetitors();
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

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="font-medium">Competitor Monitoring</p>
            <p className="text-xs text-muted-foreground">
              Track engagement on competitor posts ({competitors.length}/10)
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
          {/* Competitor list */}
          {competitors.length > 0 && (
            <div className="space-y-2 mb-4">
              {competitors.map((comp) => (
                <div
                  key={comp.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    !comp.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {comp.name || comp.linkedin_profile_url.replace(/.*\/in\//, '').replace(/\/$/, '')}
                    </p>
                    {comp.headline && (
                      <p className="text-xs text-muted-foreground truncate">{comp.headline}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{comp.total_engagers} engagers</span>
                      <span>Scraped: {formatTimeAgo(comp.last_scraped_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleToggle(comp.id, comp.is_active)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title={comp.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                    >
                      {comp.is_active ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(comp.id)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title="Remove competitor"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {competitors.length < 10 && (
            <form onSubmit={handleAdd} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="LinkedIn profile URL or username"
                  className="flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="submit"
                  disabled={adding || !newUrl.trim()}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {adding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add
                </button>
              </div>
              <input
                type="text"
                value={newCampaignId}
                onChange={(e) => setNewCampaignId(e.target.value)}
                placeholder="HeyReach campaign ID (optional)"
                className="w-full rounded-md border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </form>
          )}
        </>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
