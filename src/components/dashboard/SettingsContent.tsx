'use client';

import { useState } from 'react';
import { User, CreditCard, Loader2, Check, Link2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { PRICING_PLANS } from '@/lib/types/integrations';

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
}

interface SettingsContentProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
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

  const currentPlan = PRICING_PLANS.find((p) => p.id === subscription?.plan) || PRICING_PLANS[0];
  const leadsharkIntegration = integrations.find((i) => i.service === 'leadshark');

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
        throw new Error('Failed to save integration');
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

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Upgrade error:', error);
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
          <div className="flex items-center gap-4">
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

          {/* Pricing plans */}
          <div className="grid gap-4 md:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-lg border p-4 transition-colors ${
                  plan.id === subscription?.plan ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
                }`}
              >
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="mb-3 text-2xl font-semibold">
                  ${plan.price}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="mb-4 space-y-1 text-sm">
                  {plan.features.slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.id === subscription?.plan ? (
                  <button disabled className="w-full rounded-lg bg-secondary py-2 text-sm font-medium transition-colors">
                    Current Plan
                  </button>
                ) : plan.id === 'free' ? null : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loading === plan.id}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {loading === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Upgrade'
                    )}
                  </button>
                )}
              </div>
            ))}
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
