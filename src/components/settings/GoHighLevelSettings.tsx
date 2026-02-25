'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Building2 } from 'lucide-react';

import { logError } from '@/lib/utils/logger';

interface GoHighLevelSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
}

export function GoHighLevelSettings({ isConnected, lastVerifiedAt }: GoHighLevelSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;

    setConnecting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/gohighlevel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to connect GoHighLevel',
        });
        return;
      }

      setFeedback({ type: 'success', message: 'Connected successfully! Refreshing...' });
      setApiKey('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logError('settings/gohighlevel', error, { step: 'connect_error' });
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to connect',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/gohighlevel/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.verified) {
        setFeedback({ type: 'success', message: 'Connection verified successfully' });
      } else {
        setFeedback({
          type: 'error',
          message: 'Connection could not be verified. Your API key may have been revoked.',
        });
      }
    } catch (error) {
      logError('settings/gohighlevel', error, { step: 'verify_error' });
      setFeedback({
        type: 'error',
        message: 'Failed to verify connection',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect GoHighLevel? Leads will no longer be pushed to your CRM.')) {
      return;
    }

    setDisconnecting(true);
    setFeedback(null);

    try {
      await fetch('/api/integrations/gohighlevel/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      window.location.reload();
    } catch (error) {
      logError('settings/gohighlevel', error, { step: 'disconnect_error' });
      setFeedback({
        type: 'error',
        message: 'Failed to disconnect',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
            <Building2 className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="font-medium">GoHighLevel</p>
            <p className="text-xs text-muted-foreground">
              Push leads to your CRM when they opt in
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
            Your GoHighLevel account is connected. New funnel leads will be automatically created as contacts in your CRM.
          </p>

          {lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
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
          <p className="text-sm text-muted-foreground">
            Enter your GoHighLevel Location API key to connect your CRM.
          </p>

          <div className="relative">
            <label className="text-xs text-muted-foreground">API Key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="eyJhbGciOi..."
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

          <div className="flex items-center gap-2">
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
                setFeedback(null);
              }}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Find your Location API key in GoHighLevel under Settings &gt; Business Profile &gt; API Keys.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect GoHighLevel to automatically push funnel leads to your CRM as contacts.
          </p>

          <button
            onClick={() => setExpanded(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect GoHighLevel
          </button>
        </div>
      )}

      {feedback?.type === 'success' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          {feedback.message}
        </p>
      )}

      {feedback?.type === 'error' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-500">
          <XCircle className="h-4 w-4" />
          {feedback.message}
        </p>
      )}
    </div>
  );
}
