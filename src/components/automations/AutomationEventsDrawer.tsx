'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  Tag,
  Reply,
  AlertCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface AutomationEvent {
  id: string;
  automation_id: string;
  event_type: string;
  commenter_name: string | null;
  commenter_provider_id: string | null;
  commenter_linkedin_url: string | null;
  comment_text: string | null;
  action_details: string | null;
  error: string | null;
  created_at: string;
}

interface AutomationEventsDrawerProps {
  automationId: string | null;
  automationName: string;
  optInUrl: string | null;
  open: boolean;
  onClose: () => void;
}

// ─── Event badge config ─────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  comment_detected: {
    label: 'Comment Detected',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    icon: <Eye className="h-3 w-3" />,
  },
  keyword_matched: {
    label: 'Keyword Matched',
    className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    icon: <Tag className="h-3 w-3" />,
  },
  dm_sent: {
    label: 'DM Sent',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <Send className="h-3 w-3" />,
  },
  reply_sent: {
    label: 'Reply Sent',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <Reply className="h-3 w-3" />,
  },
  like_sent: {
    label: 'Like Sent',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  connect_sent: {
    label: 'Connect Sent',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  follow_up_sent: {
    label: 'Follow-up Sent',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <Send className="h-3 w-3" />,
  },
  dm_failed: {
    label: 'DM Failed',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    icon: <XCircle className="h-3 w-3" />,
  },
  error: {
    label: 'Error',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    icon: <XCircle className="h-3 w-3" />,
  },
  enrichment_started: {
    label: 'Enrichment Started',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: <Loader2 className="h-3 w-3" />,
  },
  enrichment_complete: {
    label: 'Enriched',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  enrichment_failed: {
    label: 'Enrichment Failed',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    icon: <XCircle className="h-3 w-3" />,
  },
  plusvibe_pushed: {
    label: 'PlusVibe Pushed',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <Send className="h-3 w-3" />,
  },
  plusvibe_push_failed: {
    label: 'PlusVibe Failed',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const DEFAULT_EVENT_CONFIG = {
  label: 'Event',
  className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  icon: <MessageSquare className="h-3 w-3" />,
};

function getEventConfig(eventType: string) {
  return EVENT_CONFIG[eventType] || DEFAULT_EVENT_CONFIG;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ─── Main component ─────────────────────────────────────

export function AutomationEventsDrawer({
  automationId,
  automationName,
  optInUrl,
  open,
  onClose,
}: AutomationEventsDrawerProps) {
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reply state: keyed by event ID
  const [replyingEventId, setReplyingEventId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ eventId: string; success: boolean; message: string } | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!automationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/linkedin/automations/${automationId}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [automationId]);

  useEffect(() => {
    if (open && automationId) {
      fetchEvents();
    }
    if (!open) {
      // Reset state when drawer closes
      setReplyingEventId(null);
      setReplyText('');
      setSendResult(null);
    }
  }, [open, automationId, fetchEvents]);

  function handleReplyClick(event: AutomationEvent) {
    const name = event.commenter_name || 'there';
    const defaultText = optInUrl
      ? `Thanks ${name}! Here's the link: ${optInUrl}`
      : `Thanks ${name}!`;
    setReplyText(defaultText);
    setReplyingEventId(event.id);
    setSendResult(null);
  }

  function handleCancelReply() {
    setReplyingEventId(null);
    setReplyText('');
    setSendResult(null);
  }

  async function handleSendReply(event: AutomationEvent) {
    if (!automationId || !replyText.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/linkedin/automations/${automationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentSocialId: event.commenter_provider_id,
          text: replyText.trim(),
          commenterName: event.commenter_name,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send reply');
      }

      setSendResult({ eventId: event.id, success: true, message: 'Reply sent successfully!' });
      setReplyingEventId(null);
      setReplyText('');
      // Refresh events to show the new reply_sent event
      fetchEvents();
    } catch (err) {
      setSendResult({
        eventId: event.id,
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send reply',
      });
    } finally {
      setSending(false);
    }
  }

  const canReply = (eventType: string) =>
    optInUrl && (eventType === 'comment_detected' || eventType === 'keyword_matched');

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Activity</SheetTitle>
          <SheetDescription className="text-xs truncate">
            {automationName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Events will appear here once the automation processes comments
              </p>
            </div>
          )}

          {/* Timeline */}
          {!loading && events.length > 0 && (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {events.map((event) => {
                  const config = getEventConfig(event.event_type);
                  const isReplying = replyingEventId === event.id;
                  const result = sendResult?.eventId === event.id ? sendResult : null;

                  return (
                    <div key={event.id} className="relative pl-9">
                      {/* Timeline dot */}
                      <div className="absolute left-[11px] top-1.5 w-[9px] h-[9px] rounded-full border-2 border-background bg-muted-foreground/30" />

                      <div className="space-y-1.5">
                        {/* Header row: badge + time */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-[10px] px-1.5 py-0 gap-1 ${config.className}`}>
                            {config.icon}
                            {config.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatTime(event.created_at)}
                          </span>
                        </div>

                        {/* Commenter name */}
                        {event.commenter_name && (
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                            {event.commenter_name}
                          </p>
                        )}

                        {/* Comment text */}
                        {event.comment_text && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            &ldquo;{event.comment_text}&rdquo;
                          </p>
                        )}

                        {/* Action details */}
                        {event.action_details && (
                          <p className="text-xs text-muted-foreground/80 italic">
                            {event.action_details}
                          </p>
                        )}

                        {/* Error */}
                        {event.error && (
                          <p className="text-xs text-red-500 dark:text-red-400">
                            {event.error}
                          </p>
                        )}

                        {/* Reply with Link button */}
                        {canReply(event.event_type) && !isReplying && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs mt-1"
                            onClick={() => handleReplyClick(event)}
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply with Link
                          </Button>
                        )}

                        {/* Send result feedback */}
                        {result && !isReplying && (
                          <div
                            className={`text-xs flex items-center gap-1.5 mt-1 ${
                              result.success
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {result.success ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {result.message}
                          </div>
                        )}

                        {/* Inline reply editor */}
                        {isReplying && (
                          <div className="mt-2 space-y-2 p-3 rounded-lg border bg-muted/30">
                            <textarea
                              className="w-full text-xs rounded-md border bg-background px-3 py-2 min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 text-zinc-900 dark:text-zinc-100 placeholder:text-muted-foreground"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write your reply..."
                              disabled={sending}
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleSendReply(event)}
                                disabled={sending || !replyText.trim()}
                              >
                                {sending ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3 mr-1" />
                                    Send Reply
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleCancelReply}
                                disabled={sending}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
