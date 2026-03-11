'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { Button, Input, Label } from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';
import * as integrationsApi from '@/frontend/api/integrations';

interface HeyReachSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
}

export function HeyReachSettings({ isConnected, lastVerifiedAt }: HeyReachSettingsProps) {
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
      await integrationsApi.connectHeyReach({ api_key: apiKey });
      setFeedback({ type: 'success', message: 'Connected successfully! Refreshing...' });
      setApiKey('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logError('settings/heyreach', error, { step: 'connect_error' });
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
      const data = (await integrationsApi.verifyHeyReach()) as { verified?: boolean };
      if (data.verified) {
        setFeedback({ type: 'success', message: 'Connection verified successfully' });
      } else {
        setFeedback({
          type: 'error',
          message: 'Connection could not be verified. Your API key may have been revoked.',
        });
      }
    } catch (error) {
      logError('settings/heyreach', error, { step: 'verify_error' });
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
        'Are you sure you want to disconnect HeyReach? Leads will no longer be delivered via LinkedIn DM campaigns.'
      )
    ) {
      return;
    }

    setDisconnecting(true);
    setFeedback(null);

    try {
      await integrationsApi.disconnectHeyReach();
      window.location.reload();
    } catch (error) {
      logError('settings/heyreach', error, { step: 'disconnect_error' });
      setFeedback({
        type: 'error',
        message: 'Failed to disconnect',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <MessageSquare className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="font-medium">HeyReach</p>
            <p className="text-xs text-muted-foreground">
              Deliver lead magnets via LinkedIn DM campaigns
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
            Your HeyReach account is connected. You can now deliver lead magnets to leads via
            LinkedIn DM campaigns.
          </p>

          {lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}

          {/* Template Variables Reference */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium mb-2">Template Variables</p>
            <p className="text-xs text-muted-foreground mb-1">
              Use these in your HeyReach campaign message templates:
            </p>
            <div className="space-y-1">
              <p className="text-xs font-mono text-muted-foreground">
                <span className="text-foreground">{'{lead_magnet_title}'}</span> — Lead magnet name
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                <span className="text-foreground">{'{lead_magnet_url}'}</span> — Content delivery
                URL
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                <span className="text-foreground">{'{utm_source}'}</span> — UTM source
              </p>
            </div>
          </div>

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
            Enter your HeyReach API key to connect your account.
          </p>

          <div>
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <div className="relative mt-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="hr_..."
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

          <div className="flex items-center gap-2">
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
                setFeedback(null);
              }}
            >
              Cancel
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Find your API key in HeyReach under Settings &gt; Integrations &gt; API.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect HeyReach to deliver lead magnets to leads via LinkedIn DM campaigns.
          </p>

          <Button onClick={() => setExpanded(true)}>Connect HeyReach</Button>
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
