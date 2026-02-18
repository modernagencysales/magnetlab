'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Creator {
  id: string;
  linkedin_url: string;
  name: string | null;
  headline: string | null;
  avg_engagement: number;
  post_count: number;
  last_scraped_at: string | null;
  added_by_user_id: string;
}

export function TrackedCreators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/content-pipeline/creators');
      if (res.ok) {
        const data = await res.json();
        setCreators(data.creators || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCreator = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/content-pipeline/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: newUrl.trim(), name: newName.trim() || undefined }),
      });
      if (res.ok) {
        setNewUrl('');
        setNewName('');
        load();
      }
    } finally {
      setAdding(false);
    }
  };

  const removeCreator = async (id: string) => {
    await fetch(`/api/content-pipeline/creators/${id}`, { method: 'DELETE' });
    setCreators((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Tracked Creators</h3>
        <Badge variant="secondary" className="text-xs">
          {creators.length} creator{creators.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Add creator form */}
      <div className="flex gap-2">
        <Input
          placeholder="LinkedIn profile URL"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Name (optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-40"
        />
        <button
          onClick={addCreator}
          disabled={adding || !newUrl.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Track
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : creators.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No creators tracked yet. Add LinkedIn profile URLs above to start discovering winning templates.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {creators.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/30">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">
                      {c.name || 'Unknown Creator'}
                    </span>
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {c.headline && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{c.headline}</p>
                  )}
                </div>
                <button
                  onClick={() => removeCreator(c.id)}
                  className="ml-2 flex-shrink-0 rounded-lg p-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Avg: {Math.round(c.avg_engagement)} engagement</span>
                <span>{c.post_count} posts</span>
                {c.last_scraped_at && (
                  <span>
                    Last scraped: {new Date(c.last_scraped_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
