'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Play, Loader2, Check, X, Globe } from 'lucide-react';
import { Button, Input, Label, Badge } from '@magnetlab/magnetui';
import type { WebhookConfig } from '@/lib/types/funnel';

import { logError } from '@/lib/utils/logger';
import * as webhooksApi from '@/frontend/api/webhooks';

export function WebhookSettings() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New webhook form
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const data = await webhooksApi.getWebhooks();
      setWebhooks((data.webhooks || []) as WebhookConfig[]);
    } catch (err) {
      logError('settings/webhooks', err, { step: 'fetch_webhooks_error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUrl) return;

    setSaving(true);
    setError(null);

    try {
      const data = await webhooksApi.createWebhook({ name: newName, url: newUrl });
      const webhook = data.webhook as WebhookConfig;
      setWebhooks([webhook, ...webhooks]);
      setNewName('');
      setNewUrl('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (webhook: WebhookConfig) => {
    try {
      const data = await webhooksApi.updateWebhook(webhook.id, {
        isActive: !webhook.isActive,
      });
      const updated = data.webhook as WebhookConfig;
      setWebhooks(webhooks.map((w) => (w.id === webhook.id ? updated : w)));
    } catch (err) {
      logError('settings/webhooks', err, { step: 'toggle_webhook_error' });
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await webhooksApi.deleteWebhook(webhookId);
      setWebhooks(webhooks.filter((w) => w.id !== webhookId));
    } catch (err) {
      logError('settings/webhooks', err, { step: 'delete_webhook_error' });
    }
  };

  const handleTest = async (webhookId: string) => {
    setTesting(webhookId);
    setTestResult(null);

    try {
      const data = await webhooksApi.testWebhook(webhookId);
      setTestResult({
        id: webhookId,
        success: data.success,
        message: data.message ?? '',
      });
    } catch (err) {
      setTestResult({
        id: webhookId,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Webhooks</h3>
          <p className="text-sm text-muted-foreground">Get notified when new leads are captured</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* Add Webhook Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border bg-card p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My CRM Webhook"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>URL (HTTPS only)</Label>
              <Input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !newName || !newUrl}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Webhook
            </Button>
          </div>
        </form>
      )}

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No webhooks configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a webhook to receive lead data in real-time
            </p>
          </div>
        ) : (
          webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-lg border bg-card p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      webhook.isActive ? 'bg-green-500' : 'bg-zinc-400'
                    }`}
                  />
                  <h4 className="font-medium truncate">{webhook.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground truncate mt-1">{webhook.url}</p>
                {testResult?.id === webhook.id && (
                  <p
                    className={`text-xs mt-2 ${
                      testResult.success ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {testResult.success ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {testResult.message}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <X className="h-3 w-3" />
                        {testResult.message}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleTest(webhook.id)}
                  disabled={testing === webhook.id}
                  title="Test webhook"
                >
                  {testing === webhook.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Badge
                  variant={webhook.isActive ? 'green' : 'gray'}
                  className="cursor-pointer"
                  onClick={() => handleToggleActive(webhook)}
                >
                  {webhook.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(webhook.id)}
                  className="text-muted-foreground hover:text-red-500"
                  title="Delete webhook"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Webhook Payload Info */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h4 className="text-sm font-medium mb-2">Webhook Payload</h4>
        <p className="text-xs text-muted-foreground mb-3">
          When a lead is captured, we&apos;ll send a POST request with this JSON payload:
        </p>
        <pre className="text-xs bg-background rounded-lg p-3 overflow-x-auto">
          {`{
  "event": "lead.created",
  "timestamp": "2025-01-26T12:00:00Z",
  "data": {
    "leadId": "uuid",
    "email": "lead@example.com",
    "name": "John Doe",
    "isQualified": true,
    "qualificationAnswers": { "q1": "yes", "q2": "no" },
    "leadMagnetTitle": "Your Lead Magnet",
    "funnelPageSlug": "your-page",
    "utmSource": "linkedin",
    "utmMedium": "social",
    "utmCampaign": "launch",
    "createdAt": "2025-01-26T12:00:00Z"
  }
}`}
        </pre>
        <div className="mt-3 flex items-center gap-4">
          <Link
            href="/docs/connect-email-list"
            className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
          >
            Integration guides (Zapier, Make, n8n) →
          </Link>
          <Link
            href="/docs/webhook-reference-ai"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            AI-friendly reference →
          </Link>
        </div>
      </div>
    </div>
  );
}
