'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2, ChevronDown, ExternalLink, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectRecorderGuideProps {
  onClose: () => void;
}

// ─── Tool configs ─────────────────────────────────────────

interface RecorderTool {
  id: string;
  name: string;
  logo: string;
  zapierUrl: string | null;
  makeUrl: string | null;
  method: 'zapier' | 'webhook' | 'both';
  steps: string[];
  notes?: string;
}

const TOOLS: RecorderTool[] = [
  {
    id: 'fathom',
    name: 'Fathom',
    logo: '🎙',
    zapierUrl: 'https://zapier.com/apps/fathom/integrations/webhook',
    makeUrl: null,
    method: 'both',
    steps: [
      'Go to Settings and click "Connect Fathom" — transcripts sync automatically every 30 minutes',
      'No Zapier or webhook setup needed with the native integration',
      'Fallback: You can also use Zapier → Fathom trigger → POST to your webhook URL below',
    ],
    notes: 'We recommend the native integration — no Zapier needed. Just connect your Fathom account in Settings and transcripts flow in automatically.',
  },
  {
    id: 'otter',
    name: 'Otter.ai',
    logo: '🦦',
    zapierUrl: 'https://zapier.com/apps/otterai/integrations/webhook',
    makeUrl: null,
    method: 'zapier',
    steps: [
      'Open Zapier and create a new Zap',
      'Trigger: Otter.ai → "New Recording" (requires Otter Pro plan)',
      'Action: Webhooks by Zapier → POST to your webhook URL below',
      'Map: recording_id → recording ID, transcript → full transcript field, title → recording title',
      'Set source to "otter" in the JSON body',
      'Turn on the Zap',
    ],
    notes: 'Otter Pro ($17/mo+) required. The Zapier integration includes the full transcript — emails only send summaries.',
  },
  {
    id: 'fireflies',
    name: 'Fireflies.ai',
    logo: '🔥',
    zapierUrl: null,
    makeUrl: 'https://www.make.com/en/help/app/fireflies-ai',
    method: 'both',
    steps: [
      'Option A (Make.com): Create a scenario with Fireflies → "Watch Transcripts" trigger',
      'Use the "Get a Transcript" module to fetch the full text',
      'Send to your webhook URL with an HTTP POST module',
      'Option B (Direct): Use our built-in Fireflies integration instead — go to your Fireflies webhook settings and paste the Grain/Fireflies webhook URL from the docs',
    ],
    notes: 'Fireflies emails only contain summaries. Use Make.com (not Zapier) — it has a "Get Transcript" module that returns the full text. Zapier only gets the URL.',
  },
  {
    id: 'tldv',
    name: 'tl;dv',
    logo: '📹',
    zapierUrl: 'https://zapier.com/apps/tl-dv/integrations/webhook',
    makeUrl: null,
    method: 'both',
    steps: [
      'Option A (Native webhook): Go to tl;dv Settings → API & Webhooks',
      'Add your webhook URL. Select the "TranscriptReady" event',
      'The webhook payload includes the full transcript with speaker names',
      'Option B (Zapier): Trigger → "Transcript Ready", Action → POST to your webhook URL',
    ],
    notes: 'tl;dv has the best native webhook — the payload already includes the full transcript. No Zapier needed if you use the direct webhook.',
  },
  {
    id: 'readai',
    name: 'Read.ai',
    logo: '📖',
    zapierUrl: null,
    makeUrl: null,
    method: 'webhook',
    steps: [
      'Go to Read.ai → Analytics → Integrations → Webhooks',
      'Add your webhook URL below',
      'Read.ai sends the full transcript with speaker names and timestamps automatically after each meeting',
    ],
    notes: 'Requires Read.ai Pro or Enterprise. The webhook payload includes the complete transcript — this is one of the simplest setups.',
  },
  {
    id: 'tactiq',
    name: 'Tactiq',
    logo: '💬',
    zapierUrl: 'https://zapier.com/apps/tactiq/integrations/webhook',
    makeUrl: null,
    method: 'zapier',
    steps: [
      'Open Zapier and create a new Zap',
      'Trigger: Tactiq → "Meeting Transcript Is Ready"',
      'Action: Webhooks by Zapier → POST to your webhook URL',
      'Map the transcript, title, and recording ID fields',
      'Set source to "tactiq" in the JSON body',
      'Turn on the Zap',
    ],
    notes: 'Tactiq is a Chrome extension (browser-only). Full word-for-word transcript available via Zapier.',
  },
  {
    id: 'krisp',
    name: 'Krisp',
    logo: '🎧',
    zapierUrl: null,
    makeUrl: null,
    method: 'webhook',
    steps: [
      'Go to Krisp → Settings → Webhook API',
      'Paste your webhook URL below',
      'Krisp automatically sends transcripts and notes after each meeting',
    ],
    notes: 'Krisp has a built-in webhook that sends full transcripts. Free plan includes unlimited transcription.',
  },
  {
    id: 'grain',
    name: 'Grain',
    logo: '🌾',
    zapierUrl: 'https://zapier.com/apps/grain/integrations/webhook',
    makeUrl: null,
    method: 'both',
    steps: [
      'We have a native Grain integration built-in!',
      'Go to Grain → Settings → Webhooks and paste the Grain-specific webhook URL from Settings',
      'Or use Zapier: Trigger → "New Recording" → map the transcript field to POST',
    ],
    notes: 'The native Grain integration is already set up. If you have a Grain webhook secret configured, transcripts flow in automatically.',
  },
];

// ─── Component ────────────────────────────────────────────

export function ConnectRecorderGuide({ onClose }: ConnectRecorderGuideProps) {
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/content-pipeline/transcripts/webhook-config');
        if (res.ok) {
          const data = await res.json();
          setWebhookUrl(data.webhook_url);
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleCopy = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Connect Your Meeting Recorder</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Auto-import transcripts from any recording tool
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* How it works — 3 steps */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-semibold mb-3">How it works</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</div>
                <p className="mt-2 text-xs font-medium">Copy your webhook URL</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</div>
                <p className="mt-2 text-xs font-medium">Connect via Zapier or tool settings</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</div>
                <p className="mt-2 text-xs font-medium">Transcripts auto-import after calls</p>
              </div>
            </div>
          </div>

          {/* Webhook URL — the star of the show */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Your Webhook URL</label>
            {loading ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : webhookUrl ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 overflow-hidden rounded-lg border bg-muted/50 px-3 py-2.5">
                  <code className="block truncate text-xs text-muted-foreground">{webhookUrl}</code>
                </div>
                <button
                  onClick={handleCopy}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    copied
                      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Webhook not configured. Ask your admin to set the TRANSCRIPT_WEBHOOK_SECRET environment variable.
              </div>
            )}
          </div>

          {/* Tool list */}
          <div>
            <p className="mb-3 text-sm font-semibold">Choose your recording tool</p>
            <div className="space-y-2">
              {TOOLS.map((tool) => (
                <div key={tool.id} className="rounded-lg border">
                  <button
                    onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-xl">{tool.logo}</span>
                    <span className="flex-1 text-sm font-medium">{tool.name}</span>
                    <div className="flex items-center gap-2">
                      {tool.zapierUrl && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                          Zapier
                        </span>
                      )}
                      {tool.method === 'webhook' || tool.method === 'both' ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Webhook
                        </span>
                      ) : null}
                      <ChevronDown className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        expandedTool === tool.id && 'rotate-180'
                      )} />
                    </div>
                  </button>

                  {expandedTool === tool.id && (
                    <div className="border-t px-4 py-3 space-y-3">
                      <ol className="space-y-2">
                        {tool.steps.map((step, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                              {i + 1}
                            </span>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ))}
                      </ol>

                      {tool.notes && (
                        <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                          {tool.notes}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {tool.zapierUrl && (
                          <a
                            href={tool.zapierUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open in Zapier
                          </a>
                        )}
                        {tool.makeUrl && (
                          <a
                            href={tool.makeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open in Make
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Custom / advanced — collapsible payload reference */}
          <div className="rounded-lg border">
            <button
              onClick={() => setShowPayload(!showPayload)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            >
              <Webhook className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Other tool / custom integration</span>
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                showPayload && 'rotate-180'
              )} />
            </button>
            {showPayload && (
              <div className="border-t px-4 py-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  POST to your webhook URL with this JSON body:
                </p>
                <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-200">
{`{
  "source": "your-tool-name",
  "recording_id": "unique-id",
  "title": "Call title",
  "date": "2026-02-09T10:00:00Z",
  "duration_minutes": 45,
  "participants": ["alice@example.com"],
  "transcript": "Full transcript text..."
}`}
                </pre>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Required:</strong> recording_id, transcript</p>
                  <p><strong>Optional:</strong> source (defaults to &quot;other&quot;), title, date, duration_minutes, participants</p>
                  <p><strong>Deduplication:</strong> Same source + recording_id combination won&apos;t be processed twice</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
