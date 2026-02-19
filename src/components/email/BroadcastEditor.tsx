'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Send,
  Save,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AudienceFilterBuilder } from '@/components/email/AudienceFilterBuilder';
import { formatDateTime } from '@/lib/utils';
import type { EmailBroadcast, AudienceFilter, BroadcastStatus } from '@/lib/types/email-system';

interface BroadcastEditorProps {
  broadcastId: string;
}

const STATUS_STYLES: Record<BroadcastStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  sending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: 'Draft',
  sending: 'Sending...',
  sent: 'Sent',
  failed: 'Failed',
};

export function BroadcastEditor({ broadcastId }: BroadcastEditorProps) {
  const router = useRouter();

  // Broadcast data
  const [broadcast, setBroadcast] = useState<EmailBroadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Send state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreviewCount, setLoadingPreviewCount] = useState(false);

  // Track if it's the initial load to avoid saving on mount
  const initialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDraft = broadcast?.status === 'draft';
  const isSent = broadcast?.status === 'sent';
  const isSending = broadcast?.status === 'sending';
  const isFailed = broadcast?.status === 'failed';
  const isReadOnly = isSent || isSending;

  // Fetch broadcast on mount
  useEffect(() => {
    async function fetchBroadcast() {
      try {
        const response = await fetch(`/api/email/broadcasts/${broadcastId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Broadcast not found');
          }
          throw new Error('Failed to load broadcast');
        }
        const data = await response.json();
        const b = data.broadcast as EmailBroadcast;
        setBroadcast(b);
        setSubject(b.subject || '');
        setBody(b.body || '');
        setAudienceFilter(b.audience_filter || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load broadcast');
      } finally {
        setLoading(false);
        // Allow changes tracking after initial data loads
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 100);
      }
    }
    fetchBroadcast();
  }, [broadcastId]);

  // Track unsaved changes
  useEffect(() => {
    if (initialLoadRef.current || !broadcast) return;
    setHasUnsavedChanges(true);
  }, [subject, body, audienceFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save function
  const saveDraft = useCallback(async () => {
    if (!broadcast || broadcast.status !== 'draft') return;

    setSaving(true);
    try {
      const response = await fetch(`/api/email/broadcasts/${broadcastId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          audience_filter: audienceFilter,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save broadcast');
      }

      const data = await response.json();
      setBroadcast(data.broadcast);
      setHasUnsavedChanges(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [broadcastId, broadcast, subject, body, audienceFilter]);

  // Auto-save on blur (debounced)
  const handleBlur = useCallback(() => {
    if (!isDraft || !hasUnsavedChanges) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, 300);
  }, [isDraft, hasUnsavedChanges, saveDraft]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle audience filter change — save immediately
  const handleAudienceFilterChange = useCallback(
    (newFilter: AudienceFilter | null) => {
      setAudienceFilter(newFilter);
      if (!isDraft || initialLoadRef.current) return;

      // Debounce save for filter changes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const response = await fetch(`/api/email/broadcasts/${broadcastId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject,
              body,
              audience_filter: newFilter,
            }),
          });
          if (!response.ok) throw new Error('Failed to save');
          const data = await response.json();
          setBroadcast(data.broadcast);
          setHasUnsavedChanges(false);
        } catch {
          toast.error('Failed to save audience filter');
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [isDraft, broadcastId, subject, body]
  );

  // Fetch preview count before showing send dialog
  const handleOpenSendDialog = async () => {
    setLoadingPreviewCount(true);
    setSendDialogOpen(true);

    try {
      // Save first if there are unsaved changes
      if (hasUnsavedChanges) {
        await saveDraft();
      }

      const response = await fetch(`/api/email/broadcasts/${broadcastId}/preview-count`);
      if (!response.ok) throw new Error('Failed to get recipient count');
      const data = await response.json();
      setPreviewCount(data.count);
    } catch {
      setPreviewCount(null);
    } finally {
      setLoadingPreviewCount(false);
    }
  };

  // Send broadcast
  const handleSend = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/email/broadcasts/${broadcastId}/send`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send broadcast');
      }

      const data = await response.json();
      toast.success(`Broadcast queued for sending to ${data.recipient_count} subscribers`);
      setSendDialogOpen(false);

      // Update local state to reflect sending status
      setBroadcast((prev) =>
        prev ? { ...prev, status: 'sending', recipient_count: data.recipient_count } : prev
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  // Retry failed broadcast — set status back to draft
  const handleRetry = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/email/broadcasts/${broadcastId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          audience_filter: audienceFilter,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset broadcast');
      }

      // Refresh from server
      const getResponse = await fetch(`/api/email/broadcasts/${broadcastId}`);
      if (getResponse.ok) {
        const data = await getResponse.json();
        setBroadcast(data.broadcast);
      }

      toast.success('Broadcast reset to draft');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/email/broadcasts')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Broadcasts
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-200">{error || 'Broadcast not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/email/broadcasts')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Broadcasts
        </button>

        <Badge
          variant="outline"
          className={`${STATUS_STYLES[broadcast.status]} ${isSending ? 'animate-pulse' : ''}`}
        >
          {isSending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          {isSent && <CheckCircle2 className="h-3 w-3 mr-1" />}
          {isFailed && <XCircle className="h-3 w-3 mr-1" />}
          {STATUS_LABELS[broadcast.status]}
        </Badge>
      </div>

      {/* Sent state banner */}
      {isSent && broadcast.sent_at && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            Sent to {broadcast.recipient_count} subscriber{broadcast.recipient_count !== 1 ? 's' : ''} on{' '}
            {formatDateTime(broadcast.sent_at)}
          </p>
        </div>
      )}

      {/* Failed state banner */}
      {isFailed && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">
              This broadcast failed to send. You can retry by resetting it to draft.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Retry
          </Button>
        </div>
      )}

      {/* Sending state banner */}
      {isSending && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
          <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Sending to {broadcast.recipient_count} subscriber{broadcast.recipient_count !== 1 ? 's' : ''}...
          </p>
        </div>
      )}

      {/* Subject */}
      <div>
        <Input
          type="text"
          placeholder="Email subject line..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onBlur={handleBlur}
          disabled={isReadOnly}
          className="text-lg h-12 font-medium"
        />
      </div>

      {/* Body */}
      <div>
        <textarea
          placeholder="Write your email content here... Use {{first_name}} for personalization."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={handleBlur}
          disabled={isReadOnly}
          className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono leading-relaxed resize-y"
        />
      </div>

      {/* Audience Filter */}
      <AudienceFilterBuilder
        filter={audienceFilter}
        onChange={handleAudienceFilterChange}
        broadcastId={broadcastId}
      />

      {/* Actions */}
      {isDraft && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {saving && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            {!saving && hasUnsavedChanges && <span>Unsaved changes</span>}
            {!saving && !hasUnsavedChanges && <span>All changes saved</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving || !hasUnsavedChanges}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button
              onClick={handleOpenSendDialog}
              disabled={saving || !subject.trim() || !body.trim()}
            >
              <Send className="h-4 w-4" />
              Send Broadcast
            </Button>
          </div>
        </div>
      )}

      {/* Send Confirmation Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Broadcast</DialogTitle>
            <DialogDescription>
              Are you sure you want to send this broadcast?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loadingPreviewCount ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Counting recipients...
              </div>
            ) : previewCount !== null ? (
              <p className="text-sm text-muted-foreground">
                This will send to <span className="font-bold text-foreground">{previewCount}</span>{' '}
                subscriber{previewCount !== 1 ? 's' : ''}. This action cannot be undone.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || loadingPreviewCount || previewCount === 0}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
