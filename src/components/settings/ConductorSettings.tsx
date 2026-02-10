'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Zap } from 'lucide-react';

interface ConductorSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
  metadata?: {
    endpointUrl?: string;
  };
}

export function ConductorSettings({ isConnected, lastVerifiedAt, metadata }: ConductorSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [endpointUrl, setEndpointUrl] = useState(metadata?.endpointUrl || 'https://gtmconductor.com');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    verifying: boolean;
    verified: boolean | null;
    error: string | null;
  }>({ verifying: false, verified: null, error: null });

  const handleConnect = async () => {
    if (!apiKey.trim()) return;

    setStatus({ verifying: true, verified: null, error: null });

    try {
      // First verify the API key against the Conductor endpoint
      const verifyResponse = await fetch('/api/integrations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'conductor',
          api_key: apiKey,
          metadata: { endpointUrl: endpointUrl.replace(/\/+$/, '') },
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.verified) {
        setStatus({
          verifying: false,
          verified: false,
          error: verifyData.error || 'Invalid API key or endpoint',
        });
        return;
      }

      // Save the integration with endpoint URL in metadata
      const saveResponse = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'conductor',
          api_key: apiKey,
          metadata: { endpointUrl: endpointUrl.replace(/\/+$/, '') },
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save integration');
      }

      setStatus({ verifying: false, verified: true, error: null });
      setApiKey('');

      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setStatus({
        verifying: false,
        verified: false,
        error: error instanceof Error ? error.message : 'Failed to save',
      });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Conductor? Leads will no longer be pushed to your GTM pipeline.')) {
      return;
    }

    setLoading(true);
    try {
      await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'conductor', api_key: null }),
      });
      window.location.reload();
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Zap className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-medium">Conductor</p>
            <p className="text-xs text-muted-foreground">
              Push leads through your GTM pipeline
            </p>
          </div>
        </div>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your Conductor account is connected. Qualified leads will be automatically pushed through the Blueprint pipeline.
          </p>

          {metadata?.endpointUrl && (
            <p className="text-xs text-muted-foreground">
              Endpoint: <code className="bg-muted px-1 py-0.5 rounded text-xs">{metadata.endpointUrl}</code>
            </p>
          )}

          {lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-sm text-red-500 hover:text-red-600 transition-colors font-medium"
          >
            {loading ? (
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
          <p className="text-sm text-muted-foreground">
            Connect to your GTM Conductor instance to automatically push qualified leads through the Blueprint pipeline (scrape, enrich, generate).
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Conductor URL</label>
              <input
                type="url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://gtmconductor.com"
                className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="relative">
              <label className="text-xs text-muted-foreground">API Key</label>
              <div className="relative mt-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="gtm_..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={status.verifying || !apiKey.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {status.verifying ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Connect'
              )}
            </button>
          </div>

          {status.verified === true && (
            <p className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Connected successfully! Refreshing...
            </p>
          )}

          {status.error && (
            <p className="flex items-center gap-2 text-sm text-red-500">
              <XCircle className="h-4 w-4" />
              {status.error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Get your API key from your GTM Conductor dashboard under Settings &gt; API Keys.
          </p>
        </div>
      )}
    </div>
  );
}
