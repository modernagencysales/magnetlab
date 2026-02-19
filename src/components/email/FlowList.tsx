'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  AlertCircle,
  Mail,
  Calendar,
  Layers,
  Zap,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { EmailFlow } from '@/lib/types/email-system';

interface FlowWithCount extends EmailFlow {
  step_count: number;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  lead_magnet: 'Lead Magnet',
};

export function FlowList() {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFlows() {
      try {
        const response = await fetch('/api/email/flows');
        if (!response.ok) {
          throw new Error('Failed to load flows');
        }
        const data = await response.json();
        setFlows(data.flows || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load flows');
      } finally {
        setLoading(false);
      }
    }
    fetchFlows();
  }, []);

  const handleCreateFlow = async () => {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/email/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Flow', trigger_type: 'manual' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create flow');
      }

      const data = await response.json();
      router.push(`/email/flows/${data.flow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create flow');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {flows.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">No email flows yet</h3>
          <p className="mb-6 text-muted-foreground max-w-md mx-auto">
            Create your first flow to start automating emails.
          </p>
          <button
            onClick={handleCreateFlow}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Your First Flow
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              onClick={handleCreateFlow}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Flow
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => router.push(`/email/flows/${flow.id}`)}
                className="group rounded-xl border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[flow.status] || STATUS_STYLES.draft}`}
                  >
                    {flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {TRIGGER_LABELS[flow.trigger_type] || flow.trigger_type}
                  </span>
                </div>

                <h3 className="mb-1 font-semibold group-hover:text-primary truncate">
                  {flow.name}
                </h3>

                {flow.description && (
                  <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                    {flow.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {flow.step_count} step{flow.step_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(flow.created_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
