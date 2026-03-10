'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Copy, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import * as integrationsApi from '@/frontend/api/integrations';

interface FathomSettingsProps {
  isConnected: boolean;
}

export function FathomSettings({ isConnected }: FathomSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(isConnected);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const clearFeedback = useCallback(() => {
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (feedback) {
      const cleanup = clearFeedback();
      return cleanup;
    }
  }, [feedback, clearFeedback]);

  // Fetch existing webhook URL on mount if connected
  useEffect(() => {
    if (!isConnected) return;

    const fetchUrl = async () => {
      try {
        const data = await integrationsApi.getFathomWebhookUrl();
        if (data.configured && data.webhook_url) {
          setWebhookUrl(data.webhook_url);
          setConfigured(true);
        } else {
          setConfigured(false);
        }
      } catch {
        // Silently fail — user can generate a new URL
      }
    };

    fetchUrl();
  }, [isConnected]);

  const handleGenerate = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await integrationsApi.createFathomWebhookUrl();
      setWebhookUrl(data.webhook_url);
      setConfigured(true);
      setFeedback({
        type: 'success',
        message: 'Webhook URL generated. Paste it into your Fathom settings.',
      });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to generate webhook URL. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate your webhook URL? The old URL will stop working immediately.')) return;
    await handleGenerate();
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Fathom? Your webhook URL will stop working.')) return;
    setLoading(true);
    setFeedback(null);
    try {
      await integrationsApi.deleteFathomWebhookUrl();
      setWebhookUrl(null);
      setConfigured(false);
      setFeedback({ type: 'success', message: 'Fathom disconnected.' });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to disconnect Fathom.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to copy to clipboard.' });
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Video className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-medium">Fathom</p>
            <p className="text-xs text-muted-foreground">
              Auto-sync meeting transcripts to your content pipeline
            </p>
          </div>
        </div>
        {configured && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {configured && webhookUrl ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste this webhook URL into your Fathom settings. Transcripts will sync automatically
            when meetings end.
          </p>

          {/* Webhook URL display */}
          <div className="flex items-start gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all select-all">
              {webhookUrl}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy} title="Copy webhook URL">
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Regenerate URL
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-red-500 hover:text-red-600"
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Fathom to automatically import meeting transcripts into your content pipeline.
            We&apos;ll generate a webhook URL that you paste into your Fathom settings.
          </p>

          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Connect Fathom'
            )}
          </Button>
        </div>
      )}

      {feedback && (
        <p
          className={`mt-3 flex items-center gap-2 text-sm ${
            feedback.type === 'success' ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
