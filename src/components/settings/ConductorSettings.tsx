'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Zap } from 'lucide-react';
import { Button, Input, Label } from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';
import * as integrationsApi from '@/frontend/api/integrations';

interface ConductorSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
  metadata?: {
    endpointUrl?: string;
  };
}

export function ConductorSettings({
  isConnected,
  lastVerifiedAt,
  metadata,
}: ConductorSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [endpointUrl, setEndpointUrl] = useState(
    metadata?.endpointUrl || 'https://gtmconductor.com'
  );
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
      const verifyData = await integrationsApi.verifyIntegration({
        service: 'conductor',
        api_key: apiKey,
        metadata: { endpointUrl: endpointUrl.replace(/\/+$/, '') },
      });

      if (!verifyData.verified) {
        setStatus({
          verifying: false,
          verified: false,
          error: verifyData.error || 'Invalid API key or endpoint',
        });
        return;
      }

      await integrationsApi.saveIntegration({
        service: 'conductor',
        api_key: apiKey,
        metadata: { endpointUrl: endpointUrl.replace(/\/+$/, '') },
      });

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
    if (
      !confirm(
        'Are you sure you want to disconnect Conductor? Leads will no longer be pushed to your GTM pipeline.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await integrationsApi.saveIntegration({ service: 'conductor', api_key: null });
      window.location.reload();
    } catch (error) {
      logError('settings/conductor', error, { step: 'disconnect_error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Zap className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-medium">Conductor</p>
            <p className="text-xs text-muted-foreground">Push leads through your GTM pipeline</p>
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
            Your Conductor account is connected. Qualified leads will be automatically pushed
            through the Blueprint pipeline.
          </p>

          {metadata?.endpointUrl && (
            <p className="text-xs text-muted-foreground">
              Endpoint:{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">{metadata.endpointUrl}</code>
            </p>
          )}

          {lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={loading}
            className="text-destructive hover:opacity-80"
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect to your GTM Conductor instance to automatically push qualified leads through the
            Blueprint pipeline (scrape, enrich, generate).
          </p>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Conductor URL</Label>
              <Input
                type="url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://gtmconductor.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">API Key</Label>
              <div className="relative mt-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="gtm_..."
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button onClick={handleConnect} disabled={status.verifying || !apiKey.trim()}>
              {status.verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </div>

          {status.verified === true && (
            <p className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Connected successfully! Refreshing...
            </p>
          )}

          {status.error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
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
