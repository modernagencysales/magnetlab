'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, ExternalLink, Eye, EyeOff, Mail } from 'lucide-react';
import { Button, Input, Label } from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import * as integrationsApi from '@/frontend/api/integrations';

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
    iconColor: 'text-destructive',
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
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ${className ?? ''}`}
    >
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

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

      await integrationsApi.connectEmailMarketing({
        provider: provider.id,
        api_key: apiKey.trim(),
        metadata: Object.keys(metadata).length ? metadata : undefined,
      });

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
      const data = (await integrationsApi.verifyEmailMarketing({ provider: provider.id })) as {
        verified?: boolean;
      };
      if (data.verified) {
        setFeedback({ type: 'success', message: 'Connection verified successfully' });
      } else {
        setFeedback({
          type: 'error',
          message: 'Connection test failed. Credentials may have been revoked.',
        });
      }
    } catch (error) {
      logError('settings/email-marketing', error, { step: 'verify_error', provider: provider.id });
      setFeedback({ type: 'error', message: 'Failed to test connection' });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        `Are you sure you want to disconnect ${provider.name}? Active funnel integrations for this provider will be deactivated.`
      )
    ) {
      return;
    }

    setDisconnecting(true);
    setFeedback(null);

    try {
      await integrationsApi.disconnectEmailMarketing({ provider: provider.id });
      window.location.reload();
    } catch (error) {
      logError('settings/email-marketing', error, {
        step: 'disconnect_error',
        provider: provider.id,
      });
      setFeedback({ type: 'error', message: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
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
            Your {provider.name} account is connected. To start syncing leads, go to each
            funnel&apos;s <strong>Integrations</strong> tab and select a list.
          </p>

          {integration?.last_verified_at && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(integration.last_verified_at).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestConnection}
              disabled={verifying}
              className="text-primary hover:text-primary/80"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            <span className="text-muted-foreground">|</span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:opacity-80"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          </div>
        </div>
      ) : expanded ? (
        <div className="space-y-3">
          {/* Extra field for ActiveCampaign (API URL) */}
          {provider.extraField && (
            <div>
              <Label className="text-xs text-muted-foreground">{provider.extraField.label}</Label>
              <Input
                type="text"
                value={extraFieldValue}
                onChange={(e) => setExtraFieldValue(e.target.value)}
                placeholder={provider.extraField.placeholder}
                className="mt-1"
              />
            </div>
          )}

          {/* API Key input */}
          <div>
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <div className="relative mt-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${provider.name} API key`}
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

          <div className="flex items-center gap-3">
            <Button onClick={handleConnect} disabled={connecting || !apiKey.trim()}>
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setExpanded(false);
                setApiKey('');
                setExtraFieldValue('');
                setFeedback(null);
              }}
            >
              Cancel
            </Button>
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
          <Button
            onClick={() => {
              if (provider.authType === 'oauth') {
                handleConnect();
              } else {
                setExpanded(true);
              }
            }}
          >
            Connect {provider.name}
          </Button>
        </div>
      )}

      {feedback && (
        <p
          className={`mt-3 flex items-center gap-2 text-sm ${
            feedback.type === 'success' ? 'text-green-600' : 'text-destructive'
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
