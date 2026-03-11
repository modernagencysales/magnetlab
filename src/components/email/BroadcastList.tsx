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
import { Button, Badge } from '@magnetlab/magnetui';
import { formatDate } from '@/lib/utils';
import type { EmailBroadcast, BroadcastStatus } from '@/lib/types/email-system';
import * as broadcastsApi from '@/frontend/api/email/broadcasts';

type BadgeVariant = 'gray' | 'blue' | 'green' | 'red';
const STATUS_VARIANTS: Record<BroadcastStatus, BadgeVariant> = {
  draft: 'gray',
  sending: 'blue',
  sent: 'green',
  failed: 'red',
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
        const data = await broadcastsApi.listBroadcasts();
        setBroadcasts((data.broadcasts || []) as EmailBroadcast[]);
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
      const data = await broadcastsApi.createBroadcast({});
      const broadcast = data.broadcast as { id: string };
      router.push(`/email/broadcasts/${broadcast.id}`);
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
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {broadcasts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Send className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">No broadcasts yet</h3>
          <p className="mb-6 text-muted-foreground max-w-md mx-auto">
            Create your first broadcast to reach your subscribers.
          </p>
          <Button onClick={handleCreateBroadcast} disabled={creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Create Your First Broadcast
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={handleCreateBroadcast} disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Create Broadcast
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {broadcasts.map((broadcast) => (
              <button
                key={broadcast.id}
                onClick={() => router.push(`/email/broadcasts/${broadcast.id}`)}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Badge variant={STATUS_VARIANTS[broadcast.status]} className="gap-1">
                    {getStatusIcon(broadcast.status)}
                    {STATUS_LABELS[broadcast.status]}
                  </Badge>
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
                    Sent to {broadcast.recipient_count} subscriber
                    {broadcast.recipient_count !== 1 ? 's' : ''} on {formatDate(broadcast.sent_at)}
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
