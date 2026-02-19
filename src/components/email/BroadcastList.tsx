'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  AlertCircle,
  Send,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { EmailBroadcast, BroadcastStatus } from '@/lib/types/email-system';

const STATUS_STYLES: Record<BroadcastStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  sending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: 'Draft',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

export function BroadcastList() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<EmailBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBroadcasts() {
      try {
        const response = await fetch('/api/email/broadcasts');
        if (!response.ok) {
          throw new Error('Failed to load broadcasts');
        }
        const data = await response.json();
        setBroadcasts(data.broadcasts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load broadcasts');
      } finally {
        setLoading(false);
      }
    }
    fetchBroadcasts();
  }, []);

  const handleCreateBroadcast = async () => {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/email/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create broadcast');
      }

      const data = await response.json();
      router.push(`/email/broadcasts/${data.broadcast.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create broadcast');
      setCreating(false);
    }
  };

  const getSubjectDisplay = (broadcast: EmailBroadcast) => {
    return broadcast.subject?.trim() || 'Untitled';
  };

  const getStatusIcon = (status: BroadcastStatus) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'sent':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
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

      {broadcasts.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Send className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">No broadcasts yet</h3>
          <p className="mb-6 text-muted-foreground max-w-md mx-auto">
            Create your first broadcast to reach your subscribers.
          </p>
          <button
            onClick={handleCreateBroadcast}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Your First Broadcast
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              onClick={handleCreateBroadcast}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Broadcast
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {broadcasts.map((broadcast) => (
              <button
                key={broadcast.id}
                onClick={() => router.push(`/email/broadcasts/${broadcast.id}`)}
                className="group rounded-xl border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[broadcast.status]}`}
                  >
                    {getStatusIcon(broadcast.status)}
                    {STATUS_LABELS[broadcast.status]}
                  </span>
                  {broadcast.status === 'sent' && broadcast.recipient_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {broadcast.recipient_count}
                    </span>
                  )}
                </div>

                <h3 className="mb-1 font-semibold group-hover:text-primary truncate">
                  {getSubjectDisplay(broadcast)}
                </h3>

                {broadcast.status === 'sent' && broadcast.sent_at ? (
                  <p className="text-sm text-muted-foreground">
                    Sent to {broadcast.recipient_count} subscriber{broadcast.recipient_count !== 1 ? 's' : ''} on{' '}
                    {formatDate(broadcast.sent_at)}
                  </p>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                    <Calendar className="h-3 w-3" />
                    {formatDate(broadcast.created_at)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
