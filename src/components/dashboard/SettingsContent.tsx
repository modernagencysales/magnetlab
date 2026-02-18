'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { User, CreditCard, Loader2, Check, Link2, CheckCircle, XCircle, Key, Copy, Trash2, Plus, Video } from 'lucide-react';
import { PRICING_PLANS } from '@/lib/types/integrations';
import { UsernameSettings } from '@/components/settings/UsernameSettings';
import { ResendSettings } from '@/components/settings/ResendSettings';
import { ConductorSettings } from '@/components/settings/ConductorSettings';
import { FathomSettings } from '@/components/settings/FathomSettings';
import { LinkedInSettings } from '@/components/settings/LinkedInSettings';
import { TrackingPixelSettings } from '@/components/settings/TrackingPixelSettings';
import { WebhookSettings } from '@/components/settings/WebhookSettings';
import { TeamMembersSettings } from '@/components/settings/TeamMembersSettings';
import { FunnelTemplateSettings } from '@/components/settings/FunnelTemplateSettings';
import { BrandingSettings } from '@/components/settings/BrandingSettings';
import { WhiteLabelSettings } from '@/components/settings/WhiteLabelSettings';

import { logError } from '@/lib/utils/logger';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata?: Record<string, unknown>;
}

interface SettingsContentProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  username: string | null;
  subscription: {
    plan: string;
    status: string;
    current_period_end?: string;
  } | null;
  brandKit: {
    business_description?: string;
    business_type?: string;
    logos?: Array<{ name: string; imageUrl: string }>;
    default_testimonial?: { quote: string; author?: string; role?: string; result?: string } | null;
    default_steps?: { heading?: string; steps: Array<{ title: string; description: string }> } | null;
    default_theme?: string | null;
    default_primary_color?: string | null;
    default_background_style?: string | null;
    logo_url?: string | null;
    font_family?: string | null;
    font_url?: string | null;
  } | null;
  usage: {
    lead_magnets_created?: number;
    posts_scheduled?: number;
  } | null;
  integrations: Integration[];
}

export function SettingsContent({
  user,
  username,
  subscription,
  brandKit,
  usage,
  integrations,
}: SettingsContentProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Page defaults state
  const [defaultVslUrl, setDefaultVslUrl] = useState('');
  const [defaultVslUrlLoading, setDefaultVslUrlLoading] = useState(true);
  const [savingDefaultVslUrl, setSavingDefaultVslUrl] = useState(false);
  const [defaultVslUrlSaved, setDefaultVslUrlSaved] = useState(false);
  const [defaultVslUrlError, setDefaultVslUrlError] = useState<string | null>(null);
  const [defaultFunnelTemplate, setDefaultFunnelTemplate] = useState('social_proof');

  const currentPlan = PRICING_PLANS.find((p) => p.id === subscription?.plan) || PRICING_PLANS[0];
  const resendIntegration = integrations.find((i) => i.service === 'resend');
  const conductorIntegration = integrations.find((i) => i.service === 'conductor');
  const fathomIntegration = integrations.find((i) => i.service === 'fathom');
  const unipileIntegration = integrations.find((i) => i.service === 'unipile');

  // Fetch API keys and user defaults on mount
  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const response = await fetch('/api/keys');
        if (response.ok) {
          const data = await response.json();
          setApiKeys(data.keys || []);
        }
      } catch (error) {
        logError('dashboard/settings', error, { step: 'failed_to_fetch_api_keys' });
      } finally {
        setApiKeysLoading(false);
      }
    };

    const fetchUserDefaults = async () => {
      try {
        const response = await fetch('/api/user/defaults');
        if (response.ok) {
          const data = await response.json();
          setDefaultVslUrl(data.defaultVslUrl || '');
          setDefaultFunnelTemplate(data.defaultFunnelTemplate || 'social_proof');
        }
      } catch (error) {
        logError('dashboard/settings', error, { step: 'failed_to_fetch_user_defaults' });
      } finally {
        setDefaultVslUrlLoading(false);
      }
    };

    fetchApiKeys();
    fetchUserDefaults();
  }, []);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;

    setCreatingKey(true);
    setApiKeyError(null);
    setNewlyCreatedKey(null);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }

      setNewlyCreatedKey(data.key);
      setNewKeyName('');
      setApiKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          isActive: true,
          lastUsedAt: null,
          createdAt: data.createdAt,
        },
        ...prev,
      ]);
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Revoke API key "${keyName}"? This cannot be undone.`)) return;

    setLoading(`revoke-${keyId}`);
    try {
      const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      setApiKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, isActive: false } : k))
      );
    } catch (error) {
      logError('dashboard/settings', error, { step: 'revoke_error' });
    } finally {
      setLoading(null);
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const handleSaveDefaultVslUrl = async () => {
    setSavingDefaultVslUrl(true);
    setDefaultVslUrlError(null);
    setDefaultVslUrlSaved(false);

    try {
      const response = await fetch('/api/user/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultVslUrl: defaultVslUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      setDefaultVslUrlSaved(true);
      setTimeout(() => setDefaultVslUrlSaved(false), 3000);
    } catch (error) {
      setDefaultVslUrlError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingDefaultVslUrl(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and integrations</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="rounded-lg border bg-card p-6 transition-colors">
          <div className="mb-4 flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>
          <div className="flex items-center gap-4 mb-6">
            {user?.image ? (
              <Image src={user.image} alt={user.name || ''} width={64} height={64} className="h-16 w-16 rounded-full" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-foreground">
                {user?.name?.[0] || 'U'}
              </div>
            )}
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Username Settings */}
          <div className="border-t pt-6">
            <UsernameSettings currentUsername={username} />
          </div>
        </div>

        {/* Subscription Section */}
        <div className="rounded-lg border bg-card p-6 transition-colors">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Subscription</h2>
            </div>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {currentPlan.name}
            </span>
          </div>

          {/* Usage */}
          <div className="mb-6 rounded-lg bg-muted p-4">
            <p className="mb-2 text-sm font-medium">This Month&apos;s Usage</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lead Magnets</span>
              <span className="font-medium">
                {usage?.lead_magnets_created || 0} / {currentPlan.limits.leadMagnets === 999999 ? '∞' : currentPlan.limits.leadMagnets}
              </span>
            </div>
            {currentPlan.limits.scheduling && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Posts Scheduled</span>
                <span className="font-medium">{usage?.posts_scheduled || 0}</span>
              </div>
            )}
          </div>

          {/* Beta notice */}
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
            <p className="text-sm font-medium text-primary">You have full access during the beta.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              All features are unlocked for beta testers. Use the feedback button in the bottom-right corner to report bugs or request features.
            </p>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="rounded-lg border bg-card p-6 transition-colors">
          <div className="mb-4 flex items-center gap-3">
            <Link2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Integrations</h2>
          </div>

          {/* LinkedIn (Unipile) */}
          <LinkedInSettings
            isConnected={unipileIntegration?.is_active ?? false}
            accountName={(unipileIntegration?.metadata as { unipile_account_name?: string } | undefined)?.unipile_account_name ?? null}
          />

          {/* Resend */}
          <ResendSettings
            isConnected={resendIntegration?.is_active ?? false}
            lastVerifiedAt={resendIntegration?.last_verified_at ?? null}
            metadata={resendIntegration?.metadata as { fromEmail?: string; fromName?: string } | undefined}
          />

          {/* Conductor */}
          <ConductorSettings
            isConnected={conductorIntegration?.is_active ?? false}
            lastVerifiedAt={conductorIntegration?.last_verified_at ?? null}
            metadata={conductorIntegration?.metadata as { endpointUrl?: string } | undefined}
          />

          {/* Fathom */}
          <FathomSettings
            isConnected={fathomIntegration?.is_active ?? false}
            lastSyncedAt={(fathomIntegration?.metadata as { last_synced_at?: string } | undefined)?.last_synced_at ?? null}
          />

          {/* Tracking Pixels */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-semibold mb-1">Tracking Pixels</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Add conversion tracking to your funnel pages. Events fire both client-side and server-side for maximum accuracy.
            </p>
            <TrackingPixelSettings integrations={integrations} />
          </div>

          {/* Webhooks */}
          <div className="mt-6 pt-6 border-t">
            <WebhookSettings />
          </div>
        </div>

        {/* Team Members Section */}
        <TeamMembersSettings />

        {/* API Keys Section */}
        <div className="rounded-lg border bg-card p-6 transition-colors">
          <div className="mb-4 flex items-center gap-3">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            API keys allow programmatic access to your account. Keep them secret and revoke any compromised keys immediately.
          </p>

          {/* Create new key */}
          <div className="mb-6 rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Create New API Key</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g., Production, Development)"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                maxLength={100}
              />
              <button
                onClick={handleCreateApiKey}
                disabled={creatingKey || !newKeyName.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {creatingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create
                  </>
                )}
              </button>
            </div>

            {apiKeyError && (
              <p className="mt-2 flex items-center gap-2 text-sm text-red-500">
                <XCircle className="h-4 w-4" />
                {apiKeyError}
              </p>
            )}

            {newlyCreatedKey && (
              <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  API key created successfully
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-xs font-mono break-all">
                    {newlyCreatedKey}
                  </code>
                  <button
                    onClick={() => handleCopyKey(newlyCreatedKey)}
                    className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {keyCopied ? (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing keys */}
          <div>
            <p className="mb-3 text-sm font-medium">Your API Keys</p>
            {apiKeysLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No API keys yet. Create one above to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      !key.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{key.name}</p>
                        {!key.isActive && (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-500">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <code className="text-xs text-muted-foreground font-mono">
                          ml_live_...{key.prefix}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                        {key.lastUsedAt && (
                          <span className="text-xs text-muted-foreground">
                            Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {key.isActive && (
                      <button
                        onClick={() => handleRevokeApiKey(key.id, key.name)}
                        disabled={loading === `revoke-${key.id}`}
                        className="ml-4 flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors"
                      >
                        {loading === `revoke-${key.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Revoke
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Page Defaults Section */}
        <div className="rounded-lg border bg-card p-6 transition-colors">
          <div className="mb-4 flex items-center gap-3">
            <Video className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Page Defaults</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Set default values for new funnel pages. You can override these on individual funnels.
          </p>

          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Default Thank You Page Video</p>
            <p className="mb-3 text-xs text-muted-foreground">
              This video will automatically appear on new funnel thank you pages. Supports YouTube, Vimeo, and Loom.
            </p>
            {defaultVslUrlLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={defaultVslUrl}
                    onChange={(e) => setDefaultVslUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                  <button
                    onClick={handleSaveDefaultVslUrl}
                    disabled={savingDefaultVslUrl}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingDefaultVslUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>

                {defaultVslUrlSaved && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Saved successfully
                  </p>
                )}

                {defaultVslUrlError && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-red-500">
                    <XCircle className="h-4 w-4" />
                    {defaultVslUrlError}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Funnel Template */}
          <div className="rounded-lg border p-4 mt-4">
            <FunnelTemplateSettings
              currentTemplate={defaultFunnelTemplate}
              onSaved={setDefaultFunnelTemplate}
            />
          </div>

          {/* Branding */}
          <div className="rounded-lg border p-4 mt-4">
            <BrandingSettings initialData={{
              logos: brandKit?.logos,
              default_testimonial: brandKit?.default_testimonial,
              default_steps: brandKit?.default_steps,
              default_theme: brandKit?.default_theme,
              default_primary_color: brandKit?.default_primary_color,
              default_background_style: brandKit?.default_background_style,
              logo_url: brandKit?.logo_url,
              font_family: brandKit?.font_family,
              font_url: brandKit?.font_url,
            }} />
          </div>
        </div>

        {/* White Label Section */}
        <WhiteLabelSettings plan={subscription?.plan} />

        {/* Brand Kit */}
        {brandKit && (
          <div className="rounded-lg border bg-card p-6 transition-colors">
            <h2 className="mb-4 text-lg font-semibold">Brand Kit</h2>
            <p className="text-sm text-muted-foreground">
              {brandKit.business_description?.slice(0, 200)}...
            </p>
            <a
              href="/create"
              className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Update Brand Kit
            </a>
          </div>
        )}

        {/* API Docs */}
        <div id="api-docs" className="rounded-lg border bg-card p-6 transition-colors">
          <div className="mb-4 flex items-center gap-3">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">API & Content Pipeline Docs</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Documentation for the Content Pipeline API, webhooks, and integrations.
          </p>
          <a
            href="#api-docs"
            className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View Full Documentation &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
