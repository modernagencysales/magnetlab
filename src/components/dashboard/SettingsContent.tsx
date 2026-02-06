'use client';

import { useState, useEffect } from 'react';
import { User, CreditCard, Loader2, Check, Link2, Eye, EyeOff, CheckCircle, XCircle, Key, Copy, Trash2, Plus, Video } from 'lucide-react';
import { PRICING_PLANS } from '@/lib/types/integrations';
import { UsernameSettings } from '@/components/settings/UsernameSettings';
import { ResendSettings } from '@/components/settings/ResendSettings';

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
  const [leadsharkKey, setLeadsharkKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{
    verifying: boolean;
    verified: boolean | null;
    error: string | null;
  }>({ verifying: false, verified: null, error: null });

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

  const currentPlan = PRICING_PLANS.find((p) => p.id === subscription?.plan) || PRICING_PLANS[0];
  const leadsharkIntegration = integrations.find((i) => i.service === 'leadshark');
  const resendIntegration = integrations.find((i) => i.service === 'resend');

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
        console.error('Failed to fetch API keys:', error);
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
        }
      } catch (error) {
        console.error('Failed to fetch user defaults:', error);
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
      console.error('Revoke error:', error);
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

  const handleSaveLeadshark = async () => {
    if (!leadsharkKey.trim()) return;

    setIntegrationStatus({ verifying: true, verified: null, error: null });

    try {
      // First verify the API key
      const verifyResponse = await fetch('/api/integrations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'leadshark', api_key: leadsharkKey }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.verified) {
        setIntegrationStatus({
          verifying: false,
          verified: false,
          error: verifyData.error || 'Invalid API key'
        });
        return;
      }

      // Save the integration
      const saveResponse = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'leadshark', api_key: leadsharkKey }),
      });

      if (!saveResponse.ok) {
        const saveData = await saveResponse.json().catch(() => ({}));
        throw new Error(saveData.error || 'Failed to save integration');
      }

      setIntegrationStatus({ verifying: false, verified: true, error: null });
      setLeadsharkKey('');

      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setIntegrationStatus({
        verifying: false,
        verified: false,
        error: error instanceof Error ? error.message : 'Failed to save'
      });
    }
  };

  const handleDisconnectLeadshark = async () => {
    if (!confirm('Are you sure you want to disconnect LeadShark?')) return;

    setLoading('disconnect-leadshark');
    try {
      await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'leadshark', api_key: null }),
      });
      window.location.reload();
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      setLoading(null);
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
              <img src={user.image} alt={user.name || ''} className="h-16 w-16 rounded-full" />
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

          {/* LeadShark */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                  <svg className="h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">LeadShark</p>
                  <p className="text-xs text-muted-foreground">LinkedIn automation & scheduling</p>
                </div>
              </div>
              {leadsharkIntegration?.is_active && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Connected
                </span>
              )}
            </div>

            {leadsharkIntegration?.is_active ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your LeadShark account is connected. You can schedule posts directly to LinkedIn.
                </p>
                {leadsharkIntegration.last_verified_at && (
                  <p className="text-xs text-muted-foreground">
                    Last verified: {new Date(leadsharkIntegration.last_verified_at).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={handleDisconnectLeadshark}
                  disabled={loading === 'disconnect-leadshark'}
                  className="text-sm text-red-500 hover:text-red-600 transition-colors font-medium"
                >
                  {loading === 'disconnect-leadshark' ? (
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
                  Connect your LeadShark account to schedule posts directly to LinkedIn.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={leadsharkKey}
                      onChange={(e) => setLeadsharkKey(e.target.value)}
                      placeholder="Enter your LeadShark API key"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveLeadshark}
                    disabled={integrationStatus.verifying || !leadsharkKey.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {integrationStatus.verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>

                {integrationStatus.verified === true && (
                  <p className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Connected successfully! Refreshing...
                  </p>
                )}

                {integrationStatus.error && (
                  <p className="flex items-center gap-2 text-sm text-red-500">
                    <XCircle className="h-4 w-4" />
                    {integrationStatus.error}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://app.leadshark.io/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    LeadShark Settings
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Resend */}
          <ResendSettings
            isConnected={resendIntegration?.is_active ?? false}
            lastVerifiedAt={resendIntegration?.last_verified_at ?? null}
            metadata={resendIntegration?.metadata as { fromEmail?: string; fromName?: string } | undefined}
          />
        </div>

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
        </div>

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
      </div>
    </div>
  );
}
