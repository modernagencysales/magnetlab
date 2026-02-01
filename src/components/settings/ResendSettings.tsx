'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Mail } from 'lucide-react';

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
      // First verify the API key
      const verifyResponse = await fetch('/api/integrations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'resend', api_key: apiKey }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.verified) {
        setStatus({
          verifying: false,
          verified: false,
          error: verifyData.error || 'Invalid API key',
        });
        return;
      }

      // Save the integration with metadata
      const saveResponse = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'resend',
          api_key: apiKey,
          metadata: {
            fromEmail: fromEmail || null,
            fromName: fromName || null,
          },
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
    if (!confirm('Are you sure you want to disconnect your Resend account? Emails will be sent from the default MagnetLab sender.')) {
      return;
    }

    setLoading(true);
    try {
      await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'resend', api_key: null }),
      });
      window.location.reload();
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/resend/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEmail,
          fromName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      window.location.reload();
    } catch (error) {
      console.error('Update settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Mail className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-medium">Resend</p>
            <p className="text-xs text-muted-foreground">
              Send emails from your own domain
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your Resend account is connected. Emails will be sent from your verified domain.
          </p>

          {/* Sender Settings */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">Sender Settings</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">From Email</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@yourdomain.com"
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">From Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <button
              onClick={handleUpdateSettings}
              disabled={loading}
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

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
            Connect your Resend account to send emails from your own domain. Without this, emails are sent from sends.magnetlab.app.
          </p>

          <div className="space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Resend API key"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">From Email (optional)</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@yourdomain.com"
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">From Name (optional)</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
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
