'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff, Hash } from 'lucide-react';
import { Button, Input } from '@magnetlab/magnetui';
import * as signalsApi from '@/frontend/api/signals';

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
      const data = await signalsApi.listSignalKeywords();
      setKeywords((data.keywords || []) as Keyword[]);
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
      await signalsApi.createSignalKeyword(newKeyword.trim());
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
      await signalsApi.updateSignalKeyword(id, { is_active: !isActive });
      await fetchKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this keyword? Historical data will remain.')) return;
    try {
      await signalsApi.deleteSignalKeyword(id);
      await fetchKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggle(kw.id, kw.is_active)}
                      title={kw.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                    >
                      {kw.is_active ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(kw.id)}
                      title="Remove keyword"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {keywords.length < 20 && (
            <form onSubmit={handleAdd} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Enter a keyword to monitor"
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={adding || !newKeyword.trim()}>
                  {adding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add
                </Button>
              </div>
            </form>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
