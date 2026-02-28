'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata?: Record<string, unknown>;
}

interface IClosedWidgetSettingsProps {
  integration?: Integration;
}

export function IClosedWidgetSettings({ integration }: IClosedWidgetSettingsProps) {
  const [widgetId, setWidgetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const metadata = integration?.metadata as { widget_id?: string } | undefined;

  const sanitizeWidgetId = (value: string) => value.replace(/[^a-zA-Z0-9-]/g, '');

  const handleConnect = async () => {
    const sanitized = sanitizeWidgetId(widgetId.trim());
    if (!sanitized) return;

    setSaving(true);
    setResult(null);

    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'iclosed_widget',
          api_key: 'connected',
          metadata: { widget_id: sanitized },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }

      setResult({ success: true, message: 'iClosed Widget connected!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect iClosed Widget?')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'iclosed_widget', api_key: null }),
      });
      window.location.reload();
    } catch {
      setResult({ success: false, message: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <svg className="h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
          </div>
          <div>
            <p className="font-medium">iClosed Lift Widget</p>
            <p className="text-xs text-muted-foreground">Floating CTA widget on content pages</p>
          </div>
        </div>
        {integration?.is_active && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {integration?.is_active ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Widget ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{metadata?.widget_id}</code>
          </p>
          {integration.last_verified_at && (
            <p className="text-xs text-muted-foreground">
              Connected: {new Date(integration.last_verified_at).toLocaleDateString()}
            </p>
          )}
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-sm text-red-500 hover:text-red-600 transition-colors font-medium"
          >
            {disconnecting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Disconnecting...
              </span>
            ) : (
              'Disconnect'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Widget ID</label>
            <input
              type="text"
              value={widgetId}
              onChange={(e) => setWidgetId(sanitizeWidgetId(e.target.value))}
              placeholder="WB1jQQR2OgMi"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Alphanumeric characters and hyphens only
            </p>
          </div>

          <button
            onClick={handleConnect}
            disabled={saving || !widgetId.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
          </button>

          {result && (
            <p className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-500'}`}>
              {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {result.message}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Find your Widget ID in your{' '}
            <a
              href="https://app.iclosed.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              iClosed dashboard
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
