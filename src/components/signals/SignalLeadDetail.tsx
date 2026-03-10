'use client';

import { useState } from 'react';
import {
  X,
  Send,
  XCircle,
  ExternalLink,
  Loader2,
  User,
  MapPin,
  Briefcase,
  Mail,
  Activity,
  Target,
  Hash,
} from 'lucide-react';
import { Button, Badge, Input } from '@magnetlab/magnetui';
import type { SignalLead, SignalEvent, SignalType, SentimentScore } from '@/lib/types/signals';

// ─── Signal type labels and styles ─────────────────────────

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  keyword_engagement: 'Keyword',
  company_engagement: 'Company',
  profile_engagement: 'Profile',
  job_change: 'Job Change',
  content_velocity: 'Content Velocity',
  job_posting: 'Job Posting',
};

type BadgeVariant = 'purple' | 'blue' | 'orange' | 'green' | 'red' | 'gray';

const SIGNAL_TYPE_VARIANTS: Record<SignalType, BadgeVariant> = {
  keyword_engagement: 'purple',
  company_engagement: 'blue',
  profile_engagement: 'orange',
  job_change: 'green',
  content_velocity: 'red',
  job_posting: 'blue',
};

const SENTIMENT_VARIANTS: Record<SentimentScore, BadgeVariant> = {
  high_intent: 'green',
  question: 'blue',
  medium_intent: 'orange',
  low_intent: 'gray',
};

const SENTIMENT_LABELS: Record<SentimentScore, string> = {
  high_intent: 'High Intent',
  question: 'Question',
  medium_intent: 'Medium',
  low_intent: 'Low',
};

// ─── Score color ────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-zinc-500 dark:text-zinc-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-zinc-100 dark:bg-zinc-800/50';
}

// ─── Props ──────────────────────────────────────────────────

interface SignalLeadWithEvents extends SignalLead {
  signal_events?: SignalEvent[];
}

interface SignalLeadDetailProps {
  lead: SignalLeadWithEvents;
  onClose: () => void;
  onExclude: (leadId: string) => Promise<void>;
  onPush: (leadId: string, campaignId: string) => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────

export function SignalLeadDetail({ lead, onClose, onExclude, onPush }: SignalLeadDetailProps) {
  const [pushCampaignId, setPushCampaignId] = useState('');
  const [showPushInput, setShowPushInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';

  const events = [...(lead.signal_events || [])].sort(
    (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  );

  const handleExclude = async () => {
    setActionLoading(true);
    try {
      await onExclude(lead.id);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePush = async () => {
    if (!pushCampaignId.trim()) return;
    setActionLoading(true);
    try {
      await onPush(lead.id, pushCampaignId.trim());
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-background shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Lead Details</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Profile card */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-violet-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-base">{fullName}</h3>
                {lead.headline && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {lead.headline}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {lead.company && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.company}</span>
                </div>
              )}
              {lead.country && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.country}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
            </div>

            {lead.linkedin_url && (
              <a
                href={lead.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View LinkedIn Profile
              </a>
            )}
          </div>

          {/* Score section */}
          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Scoring
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className={`rounded-lg p-3 text-center ${scoreBg(lead.compound_score)}`}>
                <p className={`text-2xl font-bold ${scoreColor(lead.compound_score)}`}>
                  {lead.compound_score}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Compound</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{lead.icp_score}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ICP Score</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{lead.signal_count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Signals</p>
              </div>
            </div>
            {lead.icp_match !== null && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">ICP Match: </span>
                <span
                  className={
                    lead.icp_match
                      ? 'text-green-600 dark:text-green-400 font-medium'
                      : 'text-zinc-500 font-medium'
                  }
                >
                  {lead.icp_match ? 'Yes' : 'No'}
                </span>
              </div>
            )}
          </div>

          {/* Signal events timeline */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Signal Events ({events.length})
            </h4>

            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signal events recorded.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={SIGNAL_TYPE_VARIANTS[event.signal_type]}>
                          {SIGNAL_TYPE_LABELS[event.signal_type]}
                        </Badge>
                        {event.sentiment && (
                          <Badge variant={SENTIMENT_VARIANTS[event.sentiment]}>
                            {SENTIMENT_LABELS[event.sentiment]}
                          </Badge>
                        )}
                        {event.keyword_matched && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Hash className="h-3 w-3" />
                            {event.keyword_matched}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.detected_at).toLocaleDateString()}
                      </span>
                    </div>

                    {event.comment_text && (
                      <p className="text-sm text-foreground/80 bg-muted/30 rounded-md p-2 italic">
                        &ldquo;{event.comment_text}&rdquo;
                      </p>
                    )}

                    {event.source_url && (
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border p-4 space-y-3">
          {showPushInput ? (
            <div className="space-y-2">
              <Input
                type="text"
                value={pushCampaignId}
                onChange={(e) => setPushCampaignId(e.target.value)}
                placeholder="HeyReach campaign ID..."
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handlePush}
                  disabled={!pushCampaignId.trim() || actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Push
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPushInput(false);
                    setPushCampaignId('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => setShowPushInput(true)}
                disabled={lead.status === 'pushed' || lead.status === 'excluded' || actionLoading}
              >
                <Send className="h-4 w-4" />
                Push to HeyReach
              </Button>
              <Button
                variant="destructive"
                onClick={handleExclude}
                disabled={lead.status === 'excluded' || actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Exclude
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
