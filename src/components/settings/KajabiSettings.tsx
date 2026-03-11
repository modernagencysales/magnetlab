'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import { Button, Input, Label } from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';

interface KajabiSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
}

export function KajabiSettings({ isConnected, lastVerifiedAt }: KajabiSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [siteId, setSiteId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleConnect = async () => {
    if (!apiKey.trim() || !siteId.trim()) return;

    setConnecting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/kajabi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, site_id: siteId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to connect Kajabi',
        });
        return;
      }

      setFeedback({ type: 'success', message: 'Connected successfully! Refreshing...' });
      setApiKey('');
      setSiteId('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logError('settings/kajabi', error, { step: 'connect_error' });
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
      const response = await fetch('/api/integrations/kajabi/verify', {
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
      logError('settings/kajabi', error, { step: 'verify_error' });
      setFeedback({
        type: 'error',
        message: 'Failed to verify connection',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Are you sure you want to disconnect Kajabi? Leads will no longer be pushed to your Kajabi site.'
      )
    ) {
      return;
    }

    setDisconnecting(true);
    setFeedback(null);

    try {
      await fetch('/api/integrations/kajabi/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      window.location.reload();
    } catch (error) {
      logError('settings/kajabi', error, { step: 'disconnect_error' });
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <BookOpen className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="font-medium">Kajabi</p>
            <p className="text-xs text-muted-foreground">
              Push leads to Kajabi as contacts when they opt in
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
            Your Kajabi account is connected. New funnel leads will be automatically created as
            contacts in your Kajabi site.
          </p>

          {lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying}>
              {verifying ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

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
          <p className="text-sm text-muted-foreground">
            Enter your Kajabi API key and Site ID to connect your account.
          </p>

          <div>
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <div className="relative mt-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="kbjb_..."
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

          <div>
            <Label className="text-xs text-muted-foreground">Site ID</Label>
            <Input
              type="text"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="your-site-id"
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim() || !siteId.trim()}
            >
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
                setSiteId('');
                setFeedback(null);
              }}
            >
              Cancel
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Find your API key in Kajabi Admin &gt; User API Keys. Your Site ID is in the URL when
            logged in.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Kajabi to automatically push funnel leads as contacts to your Kajabi site.
          </p>

          <Button onClick={() => setExpanded(true)}>Connect Kajabi</Button>
        </div>
      )}

      {feedback?.type === 'success' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          {feedback.message}
        </p>
      )}

      {feedback?.type === 'error' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          {feedback.message}
        </p>
      )}
    </div>
  );
}
