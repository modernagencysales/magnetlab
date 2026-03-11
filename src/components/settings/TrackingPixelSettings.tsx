'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Label, Checkbox } from '@magnetlab/magnetui';
import * as integrationsApi from '@/frontend/api/integrations';

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata?: Record<string, unknown>;
}

interface TrackingPixelSettingsProps {
  integrations: Integration[];
}

export function TrackingPixelSettings({ integrations }: TrackingPixelSettingsProps) {
  const metaIntegration = integrations.find((i) => i.service === 'meta_pixel');
  const linkedinIntegration = integrations.find((i) => i.service === 'linkedin_insight');

  return (
    <div className="space-y-4 mt-4">
      <MetaPixelCard integration={metaIntegration} />
      <LinkedInInsightCard integration={linkedinIntegration} />
    </div>
  );
}

function MetaPixelCard({ integration }: { integration?: Integration }) {
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState('');
  const [conversionValue, setConversionValue] = useState('0');
  const [enabledEvents, setEnabledEvents] = useState<string[]>(['PageView', 'Lead']);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const metadata = integration?.metadata as
    | {
        pixel_id?: string;
        enabled_events?: string[];
        default_conversion_value?: number;
        test_event_code?: string;
      }
    | undefined;

  const handleConnect = async () => {
    if (!pixelId.trim() || !accessToken.trim()) return;

    setSaving(true);
    setResult(null);

    try {
      await integrationsApi.saveIntegration({
        service: 'meta_pixel',
        api_key: accessToken.trim(),
        metadata: {
          pixel_id: pixelId.trim(),
          enabled_events: enabledEvents,
          default_conversion_value: parseFloat(conversionValue) || 0,
          test_event_code: testEventCode.trim() || undefined,
        },
      });
      setResult({ success: true, message: 'Meta Pixel connected!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Meta Pixel?')) return;
    setDisconnecting(true);
    try {
      await integrationsApi.saveIntegration({ service: 'meta_pixel', api_key: null });
      window.location.reload();
    } catch {
      setResult({ success: false, message: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  const toggleEvent = (event: string) => {
    setEnabledEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <div>
            <p className="font-medium">Meta Pixel</p>
            <p className="text-xs text-muted-foreground">Facebook/Instagram conversion tracking</p>
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
            Pixel ID:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{metadata?.pixel_id}</code>
          </p>
          <p className="text-sm text-muted-foreground">
            Events: {(metadata?.enabled_events || []).join(', ')}
          </p>
          {(metadata?.default_conversion_value ?? 0) > 0 && (
            <p className="text-sm text-muted-foreground">
              Conversion value: ${metadata?.default_conversion_value}
            </p>
          )}
          {integration.last_verified_at && (
            <p className="text-xs text-muted-foreground">
              Connected: {new Date(integration.last_verified_at).toLocaleDateString()}
            </p>
          )}
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
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Pixel ID</Label>
            <Input
              type="text"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder="123456789012345"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Conversions API Access Token</Label>
            <div className="relative mt-1">
              <Input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAAxxxxxxxx..."
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label>Events</Label>
            <div className="flex gap-3 mt-1">
              {['PageView', 'Lead'].map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={enabledEvents.includes(event)}
                    onCheckedChange={() => toggleEvent(event)}
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Default Conversion Value ($)</Label>
              <Input
                type="number"
                value={conversionValue}
                onChange={(e) => setConversionValue(e.target.value)}
                min="0"
                step="0.01"
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label>Test Event Code</Label>
              <Input
                type="text"
                value={testEventCode}
                onChange={(e) => setTestEventCode(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
          </div>

          <Button
            onClick={handleConnect}
            disabled={saving || !pixelId.trim() || !accessToken.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
          </Button>

          {result && (
            <p
              className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-destructive'}`}
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {result.message}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Get your Pixel ID and CAPI token from{' '}
            <a
              href="https://business.facebook.com/events_manager"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Meta Events Manager
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

function LinkedInInsightCard({ integration }: { integration?: Integration }) {
  const [partnerId, setPartnerId] = useState('');
  const [conversionId, setConversionId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [conversionValue, setConversionValue] = useState('0');
  const [enabledEvents, setEnabledEvents] = useState<string[]>(['PageView', 'Lead']);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const metadata = integration?.metadata as
    | {
        partner_id?: string;
        conversion_id?: string;
        enabled_events?: string[];
        default_conversion_value?: number;
      }
    | undefined;

  const handleConnect = async () => {
    if (!partnerId.trim() || !conversionId.trim() || !accessToken.trim()) return;

    setSaving(true);
    setResult(null);

    try {
      await integrationsApi.saveIntegration({
        service: 'linkedin_insight',
        api_key: accessToken.trim(),
        metadata: {
          partner_id: partnerId.trim(),
          conversion_id: conversionId.trim(),
          enabled_events: enabledEvents,
          default_conversion_value: parseFloat(conversionValue) || 0,
        },
      });
      setResult({ success: true, message: 'LinkedIn Insight Tag connected!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect LinkedIn Insight Tag?')) return;
    setDisconnecting(true);
    try {
      await integrationsApi.saveIntegration({ service: 'linkedin_insight', api_key: null });
      window.location.reload();
    } catch {
      setResult({ success: false, message: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  const toggleEvent = (event: string) => {
    setEnabledEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10">
            <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </div>
          <div>
            <p className="font-medium">LinkedIn Insight Tag</p>
            <p className="text-xs text-muted-foreground">LinkedIn conversion tracking</p>
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
            Partner ID:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{metadata?.partner_id}</code>
          </p>
          <p className="text-sm text-muted-foreground">
            Conversion ID:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {metadata?.conversion_id}
            </code>
          </p>
          <p className="text-sm text-muted-foreground">
            Events: {(metadata?.enabled_events || []).join(', ')}
          </p>
          {(metadata?.default_conversion_value ?? 0) > 0 && (
            <p className="text-sm text-muted-foreground">
              Conversion value: ${metadata?.default_conversion_value}
            </p>
          )}
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
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Partner ID</Label>
            <Input
              type="text"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="1234567"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Conversion ID</Label>
            <Input
              type="text"
              value={conversionId}
              onChange={(e) => setConversionId(e.target.value)}
              placeholder="12345678"
              className="mt-1"
            />
          </div>

          <div>
            <Label>CAPI Access Token</Label>
            <div className="relative mt-1">
              <Input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="AQXxxxxxxx..."
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label>Events</Label>
            <div className="flex gap-3 mt-1">
              {['PageView', 'Lead'].map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={enabledEvents.includes(event)}
                    onCheckedChange={() => toggleEvent(event)}
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Default Conversion Value ($)</Label>
            <Input
              type="number"
              value={conversionValue}
              onChange={(e) => setConversionValue(e.target.value)}
              min="0"
              step="0.01"
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleConnect}
            disabled={saving || !partnerId.trim() || !conversionId.trim() || !accessToken.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
          </Button>

          {result && (
            <p
              className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-destructive'}`}
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {result.message}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Get your Partner ID from{' '}
            <a
              href="https://www.linkedin.com/campaignmanager/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              LinkedIn Campaign Manager
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
