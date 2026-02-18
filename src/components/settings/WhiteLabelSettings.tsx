'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  Upload,
  X,
  ArrowUpRight,
} from 'lucide-react';

import { logError } from '@/lib/utils/logger';

interface DomainData {
  id: string;
  domain: string;
  status: 'active' | 'pending_dns';
  dns_config: {
    type: string;
    name: string;
    value: string;
    verification?: Array<{ type: string; domain: string; value: string; reason: string }>;
  } | null;
  last_checked_at: string | null;
  created_at: string;
}

interface DnsInstructions {
  type: string;
  name: string;
  value: string;
  note: string;
  verification: Array<{ type: string; domain: string; value: string; reason: string }>;
}

interface WhiteLabelSettingsProps {
  plan: string | undefined;
}

export function WhiteLabelSettings({ plan }: WhiteLabelSettingsProps) {
  // Domain state
  const [domain, setDomain] = useState<DomainData | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [dnsInstructions, setDnsInstructions] = useState<DnsInstructions | null>(null);
  const [dnsExpanded, setDnsExpanded] = useState(false);
  const [domainLoading, setDomainLoading] = useState(true);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainDeleting, setDomainDeleting] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);

  // Whitelabel branding state
  const [hideBranding, setHideBranding] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [faviconUploading, setFaviconUploading] = useState(false);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Polling state
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const [isPolling, setIsPolling] = useState(false);

  // File input ref
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const isFreeUser = plan === 'free';

  // Fetch domain data
  const fetchDomain = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/team-domain');
      if (res.ok) {
        const data = await res.json();
        setDomain(data.domain || null);
        if (data.domain?.dns_config) {
          setDnsInstructions({
            type: data.domain.dns_config.type || 'CNAME',
            name: data.domain.dns_config.name || data.domain.domain,
            value: data.domain.dns_config.value || 'cname.vercel-dns.com',
            note: 'Add this CNAME record in your domain DNS settings. Verification may take a few minutes.',
            verification: data.domain.dns_config.verification || [],
          });
        }
      }
    } catch (error) {
      logError('settings/whitelabel', error, { step: 'fetch_domain' });
    } finally {
      setDomainLoading(false);
    }
  }, []);

  // Fetch whitelabel data
  const fetchWhitelabel = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/whitelabel');
      if (res.ok) {
        const data = await res.json();
        if (data.whitelabel) {
          setHideBranding(data.whitelabel.hide_branding || false);
          setSiteName(data.whitelabel.custom_site_name || '');
          setFaviconUrl(data.whitelabel.custom_favicon_url || '');
          setEmailSenderName(data.whitelabel.custom_email_sender_name || '');
        }
      }
    } catch (error) {
      logError('settings/whitelabel', error, { step: 'fetch_whitelabel' });
    } finally {
      setBrandingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomain();
    fetchWhitelabel();
  }, [fetchDomain, fetchWhitelabel]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Start polling for DNS verification
  const startPolling = useCallback(() => {
    // Clear any existing poll
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }
    pollCountRef.current = 0;
    setIsPolling(true);

    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      // Stop after 12 polls (2 minutes at 10s intervals)
      if (pollCountRef.current >= 12) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setIsPolling(false);
        return;
      }

      try {
        const res = await fetch('/api/settings/team-domain/verify', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.verified) {
            setDomain((prev) => prev ? { ...prev, status: 'active' } : prev);
            setDomainSuccess('Domain verified successfully!');
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setIsPolling(false);
            setTimeout(() => setDomainSuccess(null), 5000);
          }
        }
      } catch {
        // Ignore polling errors silently
      }
    }, 10000);
  }, []);

  // Domain handlers
  const handleSaveDomain = async () => {
    if (!domainInput.trim()) return;

    setDomainSaving(true);
    setDomainError(null);
    setDomainSuccess(null);

    try {
      const res = await fetch('/api/settings/team-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save domain');
      }

      setDomain(data.domain);
      setDomainInput('');
      if (data.dnsInstructions) {
        setDnsInstructions(data.dnsInstructions);
        setDnsExpanded(true);
      }

      if (data.domain.status === 'active') {
        setDomainSuccess('Domain added and verified!');
        setTimeout(() => setDomainSuccess(null), 5000);
      } else {
        setDomainSuccess('Domain added. Configure DNS and verify below.');
        setTimeout(() => setDomainSuccess(null), 5000);
        // Start polling for verification
        startPolling();
      }
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Failed to save domain');
    } finally {
      setDomainSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    setDomainVerifying(true);
    setDomainError(null);

    try {
      const res = await fetch('/api/settings/team-domain/verify', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify domain');
      }

      if (data.verified) {
        setDomain((prev) => prev ? { ...prev, status: 'active' } : prev);
        setDomainSuccess('Domain verified successfully!');
        setTimeout(() => setDomainSuccess(null), 5000);
        // Stop polling if running
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          setIsPolling(false);
        }
      } else {
        setDomainError('DNS not configured yet. Make sure you have added the CNAME record and wait a few minutes for propagation.');
      }
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Failed to verify domain');
    } finally {
      setDomainVerifying(false);
    }
  };

  const handleDeleteDomain = async () => {
    if (!confirm('Remove this custom domain? Your pages will revert to the default magnetlab.app domain.')) {
      return;
    }

    setDomainDeleting(true);
    setDomainError(null);

    try {
      const res = await fetch('/api/settings/team-domain', { method: 'DELETE' });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove domain');
      }

      setDomain(null);
      setDnsInstructions(null);
      setDnsExpanded(false);
      setDomainSuccess('Domain removed.');
      setTimeout(() => setDomainSuccess(null), 3000);

      // Stop polling if running
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        setIsPolling(false);
      }
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Failed to remove domain');
    } finally {
      setDomainDeleting(false);
    }
  };

  // Branding handlers
  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFaviconUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');

      const res = await fetch('/api/brand-kit/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to upload favicon');
      }

      const data = await res.json();
      if (data.url) {
        setFaviconUrl(data.url);
      }
    } catch (error) {
      setBrandingError(error instanceof Error ? error.message : 'Failed to upload favicon');
    } finally {
      setFaviconUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    setBrandingError(null);
    setBrandingSaved(false);

    try {
      const res = await fetch('/api/settings/whitelabel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hideBranding,
          customFaviconUrl: faviconUrl || null,
          customSiteName: siteName || null,
          customEmailSenderName: emailSenderName || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save branding settings');
      }

      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    } catch (error) {
      setBrandingError(error instanceof Error ? error.message : 'Failed to save branding settings');
    } finally {
      setBrandingSaving(false);
    }
  };

  // Copy helper
  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback: some browsers block clipboard in non-secure contexts
    }
  };

  // Free user upgrade prompt
  if (isFreeUser) {
    return (
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">White Label</h2>
        </div>
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="text-sm font-medium text-primary">Upgrade to Pro to unlock White Label</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Custom domains, hide MagnetLab branding, custom favicons, and more. Available on Pro and Unlimited plans.
          </p>
          <a
            href="/settings#billing"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View Plans
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 transition-colors">
      <div className="mb-4 flex items-center gap-3">
        <Globe className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">White Label</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Use your own domain and branding on funnel pages. Remove MagnetLab branding for a fully white-labeled experience.
      </p>

      {/* ── Custom Domain ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Custom Domain</h3>

        {domainLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading domain settings...</span>
          </div>
        ) : domain ? (
          // Domain is configured
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{domain.domain}</span>
                {domain.status === 'active' ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 flex-shrink-0">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 flex-shrink-0">
                    Pending DNS
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {domain.status === 'pending_dns' && (
                  <button
                    onClick={handleVerifyDomain}
                    disabled={domainVerifying}
                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {domainVerifying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </button>
                )}
                <button
                  onClick={handleDeleteDomain}
                  disabled={domainDeleting}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {domainDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Polling indicator */}
            {isPolling && domain.status === 'pending_dns' && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking DNS automatically...
              </p>
            )}

            {/* DNS Instructions (expandable) */}
            {dnsInstructions && domain.status === 'pending_dns' && (
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setDnsExpanded(!dnsExpanded)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  <span>DNS Configuration Instructions</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      dnsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {dnsExpanded && (
                  <div className="border-t px-4 py-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Add the following DNS record in your domain provider settings:
                    </p>

                    {/* CNAME record */}
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Type</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{dnsInstructions.type}</code>
                          <button
                            onClick={() => handleCopy(dnsInstructions.type, 'type')}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === 'type' ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Name</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{dnsInstructions.name}</code>
                          <button
                            onClick={() => handleCopy(dnsInstructions.name, 'name')}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === 'name' ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Value</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{dnsInstructions.value}</code>
                          <button
                            onClick={() => handleCopy(dnsInstructions.value, 'value')}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === 'value' ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Verification records if present */}
                    {dnsInstructions.verification.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Verification Records (also required):
                        </p>
                        {dnsInstructions.verification.map((v, i) => (
                          <div key={i} className="rounded-lg bg-muted/50 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Type</span>
                              <code className="text-sm font-mono">{v.type}</code>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Name</span>
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono break-all">{v.domain}</code>
                                <button
                                  onClick={() => handleCopy(v.domain, `vdomain-${i}`)}
                                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                >
                                  {copiedField === `vdomain-${i}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Value</span>
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono break-all">{v.value}</code>
                                <button
                                  onClick={() => handleCopy(v.value, `vvalue-${i}`)}
                                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                >
                                  {copiedField === `vvalue-${i}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {v.reason && (
                              <p className="text-xs text-muted-foreground">{v.reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {dnsInstructions.note}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // No domain configured — show input
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Point your own domain to MagnetLab. Your funnel pages will be served from your custom domain.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="leads.yourdomain.com"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <button
                onClick={handleSaveDomain}
                disabled={domainSaving || !domainInput.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {domainSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Add Domain'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Domain success/error messages */}
        {domainSuccess && (
          <p className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            {domainSuccess}
          </p>
        )}
        {domainError && (
          <p className="flex items-center gap-2 text-sm text-red-500">
            <XCircle className="h-4 w-4" />
            {domainError}
          </p>
        )}
      </div>

      {/* ── Separator ── */}
      <div className="my-6 border-t" />

      {/* ── Branding Settings ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <EyeOff className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Branding</h3>
        </div>

        {brandingLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading branding settings...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hide branding checkbox */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hideBranding}
                onChange={(e) => setHideBranding(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium">Hide MagnetLab branding</span>
                <p className="text-xs text-muted-foreground">
                  Remove &quot;Powered by MagnetLab&quot; from your funnel pages
                </p>
              </div>
            </label>

            {/* Site name */}
            <div>
              <label className="mb-1 block text-sm font-medium">Site Name</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Your Brand Name"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used in page titles and email headers instead of &quot;MagnetLab&quot;
              </p>
            </div>

            {/* Favicon upload */}
            <div>
              <label className="mb-1 block text-sm font-medium">Custom Favicon</label>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/x-icon,image/svg+xml,image/ico,.ico,.png,.svg"
                onChange={handleFaviconUpload}
                className="hidden"
              />
              {faviconUrl ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/50 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={faviconUrl}
                      alt="Favicon"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={faviconUploading}
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    {faviconUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Replace'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaviconUrl('')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={faviconUploading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  {faviconUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload favicon (.ico, .png, .svg)</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Email sender name */}
            <div>
              <label className="mb-1 block text-sm font-medium">Email Sender Name</label>
              <input
                type="text"
                value={emailSenderName}
                onChange={(e) => setEmailSenderName(e.target.value)}
                placeholder="Your Company"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The sender name shown in transactional emails (e.g. lead notifications)
              </p>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveBranding}
                disabled={brandingSaving}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {brandingSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save Branding'
                )}
              </button>
              {brandingSaved && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Saved
                </span>
              )}
            </div>

            {brandingError && (
              <p className="flex items-center gap-2 text-sm text-red-500">
                <XCircle className="h-4 w-4" />
                {brandingError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
