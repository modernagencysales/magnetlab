'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Mail } from 'lucide-react';
import { Button, Input, Label } from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';
import * as integrationsApi from '@/frontend/api/integrations';

interface ResendSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
  metadata?: {
    fromEmail?: string;
    fromName?: string;
  };
}

export function ResendSettings({ isConnected, lastVerifiedAt, metadata }: ResendSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState(metadata?.fromEmail || '');
  const [fromName, setFromName] = useState(metadata?.fromName || '');
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
        service: 'resend',
        api_key: apiKey,
      });

      if (!verifyData.verified) {
        setStatus({
          verifying: false,
          verified: false,
          error: verifyData.error || 'Invalid API key',
        });
        return;
      }

      await integrationsApi.saveIntegration({
        service: 'resend',
        api_key: apiKey,
        metadata: {
          fromEmail: fromEmail || null,
          fromName: fromName || null,
        },
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
        'Are you sure you want to disconnect your Resend account? Emails will be sent from the default MagnetLab sender.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await integrationsApi.saveIntegration({ service: 'resend', api_key: null });
      window.location.reload();
    } catch (error) {
      logError('settings/resend', error, { step: 'disconnect_error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    try {
      await integrationsApi.updateResendSettings({
        fromEmail: fromEmail || null,
        fromName: fromName || null,
      });

      window.location.reload();
    } catch (error) {
      logError('settings/resend', error, { step: 'update_settings_error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Mail className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-medium">Resend</p>
            <p className="text-xs text-muted-foreground">Send emails from your own domain</p>
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your Resend account is connected. Emails will be sent from your verified domain.
          </p>

          {/* Sender Settings */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">Sender Settings</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">From Email</Label>
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@yourdomain.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">From Name</Label>
                <Input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your Name"
                  className="mt-1"
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpdateSettings}
              disabled={loading}
              className="text-primary hover:text-primary/80"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>

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
            Connect your Resend account to send emails from your own domain. Without this, emails
            are sent from sends.magnetlab.app.
          </p>

          <div className="space-y-3">
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Resend API key"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">From Email (optional)</Label>
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@yourdomain.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">From Name (optional)</Label>
                <Input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your Name"
                  className="mt-1"
                />
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
            Get your API key from{' '}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Resend Dashboard
            </a>
            . Make sure you&apos;ve verified your domain first.
          </p>
        </div>
      )}
    </div>
  );
}
