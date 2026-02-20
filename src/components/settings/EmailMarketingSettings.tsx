'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, ExternalLink, Eye, EyeOff, Mail } from 'lucide-react';

import { logError } from '@/lib/utils/logger';

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata?: Record<string, unknown>;
}

interface EmailMarketingSettingsProps {
  integrations: Integration[];
}

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  authType: 'api_key' | 'oauth';
  helpUrl?: string;
  helpLabel?: string;
  extraField?: {
    key: string;
    label: string;
    placeholder: string;
  };
  iconColor: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'kit',
    name: 'Kit (ConvertKit)',
    description: 'Email marketing for creators',
    authType: 'api_key',
    helpUrl: 'https://app.kit.com/account_settings/developer_settings',
    helpLabel: 'Kit Developer Settings',
    iconColor: 'text-red-500',
  },
  {
    id: 'mailerlite',
    name: 'MailerLite',
    description: 'Email marketing & automation',
    authType: 'api_key',
    helpUrl: 'https://dashboard.mailerlite.com/integrations/api',
    helpLabel: 'MailerLite API page',
    iconColor: 'text-green-500',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'All-in-one marketing platform',
    authType: 'oauth',
    iconColor: 'text-yellow-600',
  },
  {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    description: 'Marketing automation & CRM',
    authType: 'api_key',
    helpUrl: 'https://help.activecampaign.com/hc/en-us/articles/207317590',
    helpLabel: 'ActiveCampaign docs',
    extraField: {
      key: 'base_url',
      label: 'API URL',
      placeholder: 'https://youraccountname.api-us1.com',
    },
    iconColor: 'text-blue-500',
  },
];

function ProviderIcon({ provider, className }: { provider: ProviderConfig; className?: string }) {
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ${className ?? ''}`}>
      <Mail className={`h-5 w-5 ${provider.iconColor}`} />
    </div>
  );
}

function ProviderCard({
  provider,
  integration,
}: {
  provider: ProviderConfig;
  integration?: Integration;
}) {
  const isConnected = integration?.is_active ?? false;

  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [extraFieldValue, setExtraFieldValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleConnect = async () => {
    if (provider.authType === 'oauth') {
      // Redirect to OAuth flow
      window.location.href = '/api/integrations/mailchimp/authorize';
      return;
    }

    if (!apiKey.trim()) return;

    // Validate extra field for ActiveCampaign
    if (provider.extraField && !extraFieldValue.trim()) {
      setFeedback({ type: 'error', message: `${provider.extraField.label} is required` });
      return;
    }

    setConnecting(true);
    setFeedback(null);

    try {
      const metadata: Record<string, string> = {};
      if (provider.extraField) {
        metadata[provider.extraField.key] = extraFieldValue.trim();
      }

      const response = await fetch('/api/integrations/email-marketing/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider.id,
          api_key: apiKey.trim(),
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setFeedback({ type: 'success', message: 'Connected successfully! Refreshing...' });
      setApiKey('');
      setExtraFieldValue('');

      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to connect',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    setVerifying(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/email-marketing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.id }),
      });

      const data = await response.json();

      if (data.verified) {
        setFeedback({ type: 'success', message: 'Connection verified successfully' });
      } else {
        setFeedback({ type: 'error', message: 'Connection test failed. Credentials may have been revoked.' });
      }
    } catch (error) {
      logError('settings/email-marketing', error, { step: 'verify_error', provider: provider.id });
      setFeedback({ type: 'error', message: 'Failed to test connection' });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${provider.name}? Active funnel integrations for this provider will be deactivated.`)) {
      return;
    }

    setDisconnecting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/email-marketing/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      window.location.reload();
    } catch (error) {
      logError('settings/email-marketing', error, { step: 'disconnect_error', provider: provider.id });
      setFeedback({ type: 'error', message: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <ProviderIcon provider={provider} />
          <div>
            <p className="font-medium">{provider.name}</p>
            <p className="text-xs text-muted-foreground">{provider.description}</p>
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
            Your {provider.name} account is connected. New leads from linked funnels will be synced automatically.
          </p>

          {integration?.last_verified_at && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(integration.last_verified_at).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={verifying}
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {verifying ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </button>

            <span className="text-muted-foreground">|</span>

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
        </div>
      ) : expanded ? (
        <div className="space-y-3">
          {/* Extra field for ActiveCampaign (API URL) */}
          {provider.extraField && (
            <div>
              <label className="text-xs text-muted-foreground">{provider.extraField.label}</label>
              <input
                type="text"
                value={extraFieldValue}
                onChange={(e) => setExtraFieldValue(e.target.value)}
                placeholder={provider.extraField.placeholder}
                className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* API Key input */}
          <div>
            <label className="text-xs text-muted-foreground">API Key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${provider.name} API key`}
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

          <div className="flex items-center gap-3">
            <button
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {connecting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </span>
              ) : (
                'Connect'
              )}
            </button>
            <button
              onClick={() => {
                setExpanded(false);
                setApiKey('');
                setExtraFieldValue('');
                setFeedback(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          {provider.helpUrl && (
            <p className="text-xs text-muted-foreground">
              Find your API key at{' '}
              <a
                href={provider.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
              >
                {provider.helpLabel || provider.name}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => {
              if (provider.authType === 'oauth') {
                handleConnect();
              } else {
                setExpanded(true);
              }
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect {provider.name}
          </button>
        </div>
      )}

      {feedback && (
        <p className={`mt-3 flex items-center gap-2 text-sm ${
          feedback.type === 'success' ? 'text-green-600' : 'text-red-500'
        }`}>
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

export function EmailMarketingSettings({ integrations }: EmailMarketingSettingsProps) {
  const findIntegration = (providerId: string) =>
    integrations.find((i) => i.service === providerId);

  return (
    <div className="mt-6 pt-6 border-t">
      <h3 className="text-sm font-semibold mb-1">Email Marketing</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Connect your email marketing platform to automatically sync leads from your funnels.
      </p>
      <div className="space-y-3">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            integration={findIntegration(provider.id)}
          />
        ))}
      </div>
    </div>
  );
}
