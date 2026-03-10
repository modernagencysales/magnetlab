'use client';

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
  Mail,
} from 'lucide-react';
import { Button, Input, Label, Checkbox, Badge } from '@magnetlab/magnetui';
import { useWhiteLabelSettings } from '@/frontend/hooks/useWhiteLabelSettings';

interface WhiteLabelSettingsProps {
  plan: string | undefined;
}

export function WhiteLabelSettings({ plan }: WhiteLabelSettingsProps) {
  const {
    isFreeUser,
    // Domain
    domain,
    domainInput,
    setDomainInput,
    dnsInstructions,
    dnsExpanded,
    setDnsExpanded,
    domainLoading,
    domainSaving,
    domainVerifying,
    domainDeleting,
    domainError,
    domainSuccess,
    isPolling,
    handleSaveDomain,
    handleVerifyDomain,
    handleDeleteDomain,
    // Branding
    hideBranding,
    setHideBranding,
    siteName,
    setSiteName,
    faviconUrl,
    setFaviconUrl,
    emailSenderName,
    setEmailSenderName,
    brandingLoading,
    brandingSaving,
    brandingSaved,
    brandingError,
    faviconUploading,
    faviconInputRef,
    handleFaviconUpload,
    handleSaveBranding,
    // Email domain
    emailDomain,
    emailDomainInput,
    setEmailDomainInput,
    emailDnsExpanded,
    setEmailDnsExpanded,
    emailDomainLoading,
    emailDomainSaving,
    emailDomainVerifying,
    emailDomainDeleting,
    emailDomainError,
    emailDomainSuccess,
    isEmailPolling,
    handleSaveEmailDomain,
    handleVerifyEmailDomain,
    handleDeleteEmailDomain,
    // From email
    fromEmail,
    setFromEmail,
    fromEmailSaving,
    fromEmailSaved,
    fromEmailError,
    setFromEmailError,
    setFromEmailSaved,
    handleSaveFromEmail,
    // Copy
    copiedField,
    handleCopy,
  } = useWhiteLabelSettings(plan);

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
            Custom domains, hide MagnetLab branding, custom favicons, and more. Available on Pro and
            Unlimited plans.
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
        Use your own domain and branding on funnel pages. Remove MagnetLab branding for a fully
        white-labeled experience.
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
                  <Badge variant="green" className="gap-1 flex-shrink-0">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="orange" className="flex-shrink-0">
                    Pending DNS
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {domain.status === 'pending_dns' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyDomain}
                    disabled={domainVerifying}
                  >
                    {domainVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verify'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDeleteDomain}
                  disabled={domainDeleting}
                  className="text-red-500 hover:text-red-600"
                >
                  {domainDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
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
                <Button
                  variant="ghost"
                  onClick={() => setDnsExpanded(!dnsExpanded)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium rounded-none h-auto"
                >
                  <span>DNS Configuration Instructions</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      dnsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
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
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCopy(dnsInstructions.type, 'type')}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === 'type' ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Name</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{dnsInstructions.name}</code>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCopy(dnsInstructions.name, 'name')}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === 'name' ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Value</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{dnsInstructions.value}</code>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCopy(dnsInstructions.value, 'value')}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === 'value' ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
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
                              <span className="text-xs font-medium text-muted-foreground">
                                Type
                              </span>
                              <code className="text-sm font-mono">{v.type}</code>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Name
                              </span>
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono break-all">{v.domain}</code>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleCopy(v.domain, `vdomain-${i}`)}
                                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                                >
                                  {copiedField === `vdomain-${i}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Value
                              </span>
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono break-all">{v.value}</code>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleCopy(v.value, `vvalue-${i}`)}
                                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                                >
                                  {copiedField === `vvalue-${i}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            {v.reason && (
                              <p className="text-xs text-muted-foreground">{v.reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">{dnsInstructions.note}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // No domain configured — show input
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Point your own domain to MagnetLab. Your funnel pages will be served from your custom
              domain.
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="leads.yourdomain.com"
                className="flex-1"
              />
              <Button onClick={handleSaveDomain} disabled={domainSaving || !domainInput.trim()}>
                {domainSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Domain'}
              </Button>
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
            <div className="flex items-center gap-3">
              <Checkbox
                checked={hideBranding}
                onCheckedChange={(checked) => setHideBranding(checked === true)}
              />
              <div>
                <Label className="text-sm font-medium cursor-pointer">
                  Hide MagnetLab branding
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remove &quot;Powered by MagnetLab&quot; from your funnel pages
                </p>
              </div>
            </div>

            {/* Site name */}
            <div>
              <Label className="mb-1 block text-sm font-medium">Site Name</Label>
              <Input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Your Brand Name"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used in page titles and email headers instead of &quot;MagnetLab&quot;
              </p>
            </div>

            {/* Favicon upload */}
            <div>
              <Label className="mb-1 block text-sm font-medium">Custom Favicon</Label>
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
                    <img src={faviconUrl} alt="Favicon" className="h-full w-full object-contain" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={faviconUploading}
                  >
                    {faviconUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Replace'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFaviconUrl('')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={faviconUploading}
                  className="flex w-full items-center justify-center gap-2 border-2 border-dashed px-4 py-6 h-auto text-muted-foreground hover:border-primary/50"
                >
                  {faviconUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload favicon (.ico, .png, .svg)</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Email sender name */}
            <div>
              <Label className="mb-1 block text-sm font-medium">Email Sender Name</Label>
              <Input
                type="text"
                value={emailSenderName}
                onChange={(e) => setEmailSenderName(e.target.value)}
                placeholder="Your Company"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The sender name shown in transactional emails (e.g. lead notifications)
              </p>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveBranding} disabled={brandingSaving}>
                {brandingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Branding'}
              </Button>
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

      {/* ── Separator ── */}
      <div className="my-6 border-t" />

      {/* ── Email Domain ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Email Domain</h3>
        </div>

        {emailDomainLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading email domain settings...</span>
          </div>
        ) : emailDomain ? (
          // Email domain is configured
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{emailDomain.domain}</span>
                {emailDomain.status === 'verified' ? (
                  <Badge variant="green" className="gap-1 flex-shrink-0">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : emailDomain.status === 'failed' ? (
                  <Badge variant="red" className="gap-1 flex-shrink-0">
                    <XCircle className="h-3 w-3" />
                    Failed
                  </Badge>
                ) : (
                  <Badge variant="orange" className="flex-shrink-0">
                    Pending DNS
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {emailDomain.status !== 'verified' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyEmailDomain}
                    disabled={emailDomainVerifying}
                  >
                    {emailDomainVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verify'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDeleteEmailDomain}
                  disabled={emailDomainDeleting}
                  className="text-red-500 hover:text-red-600"
                >
                  {emailDomainDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Polling indicator */}
            {isEmailPolling && emailDomain.status !== 'verified' && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking DNS automatically...
              </p>
            )}

            {/* DNS Records (expandable) — shown when not verified */}
            {emailDomain.dns_records &&
              emailDomain.dns_records.length > 0 &&
              emailDomain.status !== 'verified' && (
                <div className="rounded-lg border">
                  <Button
                    variant="ghost"
                    onClick={() => setEmailDnsExpanded(!emailDnsExpanded)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium rounded-none h-auto"
                  >
                    <span>DNS Records</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        emailDnsExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </Button>
                  {emailDnsExpanded && (
                    <div className="border-t px-4 py-3 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Add the following DNS records in your domain provider settings:
                      </p>

                      {emailDomain.dns_records.map((rec, i) => (
                        <div key={i} className="rounded-lg bg-muted/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">
                              {rec.record}
                            </span>
                            {rec.status === 'verified' ? (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                Verified
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Type</span>
                            <code className="text-sm font-mono">{rec.type}</code>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Name</span>
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono break-all">{rec.name}</code>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleCopy(rec.name, `email-name-${i}`)}
                                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                              >
                                {copiedField === `email-name-${i}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Value</span>
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono break-all">{rec.value}</code>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleCopy(rec.value, `email-value-${i}`)}
                                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                              >
                                {copiedField === `email-value-${i}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          {rec.priority !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Priority
                              </span>
                              <code className="text-sm font-mono">{rec.priority}</code>
                            </div>
                          )}
                        </div>
                      ))}

                      <p className="text-xs text-muted-foreground">
                        DNS propagation may take up to 48 hours. We will automatically check for
                        verification.
                      </p>
                    </div>
                  )}
                </div>
              )}

            {/* From email input — only shown when domain is verified */}
            {emailDomain.status === 'verified' && (
              <div className="space-y-2">
                <Label className="block text-sm font-medium">From Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => {
                      setFromEmail(e.target.value);
                      setFromEmailError(null);
                      setFromEmailSaved(false);
                    }}
                    placeholder={`hello@${emailDomain.domain}`}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveFromEmail}
                    disabled={fromEmailSaving || !fromEmail.trim()}
                  >
                    {fromEmailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Transactional emails will be sent from this address
                </p>
                {fromEmailSaved && (
                  <p className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Saved
                  </p>
                )}
                {fromEmailError && (
                  <p className="flex items-center gap-2 text-sm text-red-500">
                    <XCircle className="h-4 w-4" />
                    {fromEmailError}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          // No email domain configured — show input
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Send transactional emails from your own domain. Add a domain and configure DNS records
              to get started.
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={emailDomainInput}
                onChange={(e) => setEmailDomainInput(e.target.value)}
                placeholder="yourdomain.com"
                className="flex-1"
              />
              <Button
                onClick={handleSaveEmailDomain}
                disabled={emailDomainSaving || !emailDomainInput.trim()}
              >
                {emailDomainSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Add Email Domain'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Email domain success/error messages */}
        {emailDomainSuccess && (
          <p className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            {emailDomainSuccess}
          </p>
        )}
        {emailDomainError && (
          <p className="flex items-center gap-2 text-sm text-red-500">
            <XCircle className="h-4 w-4" />
            {emailDomainError}
          </p>
        )}
      </div>
    </div>
  );
}
