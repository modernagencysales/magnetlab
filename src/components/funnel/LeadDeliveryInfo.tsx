'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Webhook, AlertTriangle, CheckCircle, ExternalLink, Loader2, Settings } from 'lucide-react';
import type { WebhookConfig } from '@/lib/types/funnel';

import { logError } from '@/lib/utils/logger';

export function LeadDeliveryInfo() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWebhooks() {
      try {
        const response = await fetch('/api/webhooks');
        if (response.ok) {
          const data = await response.json();
          setWebhooks(data.webhooks || []);
        }
      } catch (err) {
        logError('funnel/lead-delivery', err, { step: 'failed_to_fetch_webhooks' });
      } finally {
        setLoading(false);
      }
    }
    fetchWebhooks();
  }, []);

  const activeWebhooks = webhooks.filter(w => w.isActive);
  const hasActiveWebhooks = activeWebhooks.length > 0;

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading delivery settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${
      hasActiveWebhooks
        ? 'bg-card'
        : 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          hasActiveWebhooks
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-yellow-100 dark:bg-yellow-900/30'
        }`}>
          {hasActiveWebhooks ? (
            <Webhook className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">
            {hasActiveWebhooks ? 'Lead Delivery' : 'Set Up Lead Export'}
          </h3>

          {hasActiveWebhooks ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                New leads will be sent to your webhook{activeWebhooks.length > 1 ? 's' : ''} in real-time:
              </p>
              <div className="space-y-2">
                {activeWebhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="font-medium truncate">{webhook.name}</span>
                    <span className="text-muted-foreground truncate text-xs hidden sm:inline">
                      → {webhook.url}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-3 w-3" />
                Manage webhooks
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                Configure a webhook to receive leads in your CRM, Zapier, Make, or any tool.
                Without a webhook, leads are only stored in MagnetLab.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Set Up Webhook
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Info about lead storage */}
      <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
        <strong>Note:</strong> All leads are stored in MagnetLab and can be viewed on the{' '}
        <Link href="/leads" className="underline hover:text-foreground transition-colors">
          Leads page
        </Link>
        . Webhooks provide real-time delivery to external tools.
      </div>
    </div>
  );
}
