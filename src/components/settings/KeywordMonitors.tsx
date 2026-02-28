'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff, Hash } from 'lucide-react';

interface Keyword {
  id: string;
  keyword: string;
  is_active: boolean;
  posts_found: number;
  leads_found: number;
  created_at: string;
}

export function KeywordMonitors() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch('/api/signals/keywords');
      if (!res.ok) throw new Error('Failed to load keywords');
      const data = await res.json();
      setKeywords(data.keywords || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/signals/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim() }),
      });

      if (res.status === 409) {
        throw new Error('This keyword is already being monitored');
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add keyword');
      }

      setNewKeyword('');
      await fetchKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/signals/keywords/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this keyword? Historical data will remain.')) return;
    try {
      const res = await fetch(`/api/signals/keywords/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Hash className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="font-medium">Keyword Monitors</p>
            <p className="text-xs text-muted-foreground">
              Track posts containing specific keywords ({keywords.length}/20)
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
          {/* Keyword list */}
          {keywords.length > 0 && (
            <div className="space-y-2 mb-4">
              {keywords.map((kw) => (
                <div
                  key={kw.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    !kw.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{kw.keyword}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{kw.posts_found} posts found</span>
                      <span>{kw.leads_found} leads found</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleToggle(kw.id, kw.is_active)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title={kw.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                    >
                      {kw.is_active ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(kw.id)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title="Remove keyword"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {keywords.length < 20 && (
            <form onSubmit={handleAdd} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Enter a keyword to monitor"
                  className="flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="submit"
                  disabled={adding || !newKeyword.trim()}
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
