'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { logError } from '@/lib/utils/logger';
import * as whitelabelApi from '@/frontend/api/settings/whitelabel';
import * as teamDomainApi from '@/frontend/api/settings/team-domain';
import * as teamEmailDomainApi from '@/frontend/api/settings/team-email-domain';
import * as brandKitApi from '@/frontend/api/brand-kit';

export interface DomainData {
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

export interface DnsInstructions {
  type: string;
  name: string;
  value: string;
  note: string;
  verification: Array<{ type: string; domain: string; value: string; reason: string }>;
}

export interface EmailDomainDnsRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl: string;
  status: string;
  priority?: number;
}

export interface EmailDomainData {
  id: string;
  domain: string;
  resend_domain_id: string;
  status: 'pending' | 'verified' | 'failed';
  dns_records: EmailDomainDnsRecord[] | null;
  region: string;
  last_checked_at: string | null;
  created_at: string;
}

export function useWhiteLabelSettings(plan: string | undefined) {
  const isFreeUser = plan === 'free';

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

  // Email domain state
  const [emailDomain, setEmailDomain] = useState<EmailDomainData | null>(null);
  const [emailDomainInput, setEmailDomainInput] = useState('');
  const [emailDnsExpanded, setEmailDnsExpanded] = useState(false);
  const [emailDomainLoading, setEmailDomainLoading] = useState(true);
  const [emailDomainSaving, setEmailDomainSaving] = useState(false);
  const [emailDomainVerifying, setEmailDomainVerifying] = useState(false);
  const [emailDomainDeleting, setEmailDomainDeleting] = useState(false);
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [emailDomainSuccess, setEmailDomainSuccess] = useState<string | null>(null);

  // Email domain polling
  const emailPollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emailPollCountRef = useRef(0);
  const [isEmailPolling, setIsEmailPolling] = useState(false);

  // From email
  const [fromEmail, setFromEmail] = useState('');
  const [fromEmailSaving, setFromEmailSaving] = useState(false);
  const [fromEmailSaved, setFromEmailSaved] = useState(false);
  const [fromEmailError, setFromEmailError] = useState<string | null>(null);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Polling state
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const [isPolling, setIsPolling] = useState(false);

  // File input ref (exposed for component use)
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // ─── Data fetchers ──────────────────────────────────────────────────────────

  const fetchDomain = useCallback(async () => {
    try {
      const data = await teamDomainApi.getTeamDomain();
      const dom = data.domain as DomainData | null;
      setDomain(dom || null);
      if (dom?.dns_config) {
        setDnsInstructions({
          type: dom.dns_config.type || 'CNAME',
          name: dom.dns_config.name || dom.domain,
          value: dom.dns_config.value || 'cname.vercel-dns.com',
          note: 'Add this CNAME record in your domain DNS settings. Verification may take a few minutes.',
          verification: dom.dns_config.verification || [],
        });
      }
    } catch (error) {
      logError('settings/whitelabel', error, { step: 'fetch_domain' });
    } finally {
      setDomainLoading(false);
    }
  }, []);

  const fetchWhitelabel = useCallback(async () => {
    try {
      const data = await whitelabelApi.getWhitelabel();
      const wl = data.whitelabel as Record<string, unknown> | null;
      if (wl) {
        setHideBranding((wl.hide_branding as boolean) || false);
        setSiteName((wl.custom_site_name as string) || '');
        setFaviconUrl((wl.custom_favicon_url as string) || '');
        setEmailSenderName((wl.custom_email_sender_name as string) || '');
        setFromEmail((wl.custom_from_email as string) || '');
      }
    } catch (error) {
      logError('settings/whitelabel', error, { step: 'fetch_whitelabel' });
    } finally {
      setBrandingLoading(false);
    }
  }, []);

  const fetchEmailDomain = useCallback(async () => {
    try {
      const data = await teamEmailDomainApi.getTeamEmailDomain();
      setEmailDomain((data.emailDomain as EmailDomainData | null) || null);
    } catch (error) {
      logError('settings/whitelabel', error, { step: 'fetch_email_domain' });
    } finally {
      setEmailDomainLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomain();
    fetchWhitelabel();
    fetchEmailDomain();
  }, [fetchDomain, fetchWhitelabel, fetchEmailDomain]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (emailPollTimerRef.current) clearInterval(emailPollTimerRef.current);
    };
  }, []);

  // ─── Domain handlers ────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollCountRef.current = 0;
    setIsPolling(true);
    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= 12) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setIsPolling(false);
        return;
      }
      try {
        const data = await teamDomainApi.verifyTeamDomain();
        if (data.verified) {
          setDomain((prev) => (prev ? { ...prev, status: 'active' } : prev));
          setDomainSuccess('Domain verified successfully!');
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setIsPolling(false);
          setTimeout(() => setDomainSuccess(null), 5000);
        }
      } catch {
        // Ignore polling errors silently
      }
    }, 10000);
  }, []);

  const handleSaveDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainSaving(true);
    setDomainError(null);
    setDomainSuccess(null);
    try {
      const data = await teamDomainApi.setTeamDomain(domainInput.trim());
      const dom = data.domain as DomainData;
      setDomain(dom);
      setDomainInput('');
      if (data.dnsInstructions) {
        setDnsInstructions(data.dnsInstructions as DnsInstructions);
        setDnsExpanded(true);
      }
      if (dom.status === 'active') {
        setDomainSuccess('Domain added and verified!');
        setTimeout(() => setDomainSuccess(null), 5000);
      } else {
        setDomainSuccess('Domain added. Configure DNS and verify below.');
        setTimeout(() => setDomainSuccess(null), 5000);
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
      const data = await teamDomainApi.verifyTeamDomain();
      if (data.verified) {
        setDomain((prev) => (prev ? { ...prev, status: 'active' } : prev));
        setDomainSuccess('Domain verified successfully!');
        setTimeout(() => setDomainSuccess(null), 5000);
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          setIsPolling(false);
        }
      } else {
        setDomainError(
          'DNS not configured yet. Make sure you have added the CNAME record and wait a few minutes for propagation.'
        );
      }
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Failed to verify domain');
    } finally {
      setDomainVerifying(false);
    }
  };

  const handleDeleteDomain = async () => {
    if (
      !confirm(
        'Remove this custom domain? Your pages will revert to the default magnetlab.app domain.'
      )
    )
      return;
    setDomainDeleting(true);
    setDomainError(null);
    try {
      await teamDomainApi.deleteTeamDomain();
      setDomain(null);
      setDnsInstructions(null);
      setDnsExpanded(false);
      setDomainSuccess('Domain removed.');
      setTimeout(() => setDomainSuccess(null), 3000);
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

  // ─── Email domain handlers ──────────────────────────────────────────────────

  const startEmailPolling = useCallback(() => {
    if (emailPollTimerRef.current) clearInterval(emailPollTimerRef.current);
    emailPollCountRef.current = 0;
    setIsEmailPolling(true);
    emailPollTimerRef.current = setInterval(async () => {
      emailPollCountRef.current += 1;
      if (emailPollCountRef.current >= 12) {
        if (emailPollTimerRef.current) clearInterval(emailPollTimerRef.current);
        setIsEmailPolling(false);
        return;
      }
      try {
        const data = await teamEmailDomainApi.verifyTeamEmailDomain();
        if (data.verified) {
          setEmailDomain((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'verified',
                  dns_records: data.records as EmailDomainData['dns_records'],
                }
              : prev
          );
          setEmailDomainSuccess('Email domain verified!');
          if (emailPollTimerRef.current) clearInterval(emailPollTimerRef.current);
          setIsEmailPolling(false);
          setTimeout(() => setEmailDomainSuccess(null), 5000);
        } else if (data.records) {
          setEmailDomain((prev) =>
            prev ? { ...prev, dns_records: data.records as EmailDomainData['dns_records'] } : prev
          );
        }
      } catch {
        /* ignore */
      }
    }, 10000);
  }, []);

  const handleSaveEmailDomain = async () => {
    if (!emailDomainInput.trim()) return;
    setEmailDomainSaving(true);
    setEmailDomainError(null);
    setEmailDomainSuccess(null);
    try {
      const data = await teamEmailDomainApi.setTeamEmailDomain(emailDomainInput.trim());
      const ed = data.emailDomain as EmailDomainData;
      setEmailDomain(ed);
      setEmailDomainInput('');
      if (data.dnsRecords) setEmailDnsExpanded(true);
      if (ed.status === 'verified') {
        setEmailDomainSuccess('Email domain added and verified!');
        setTimeout(() => setEmailDomainSuccess(null), 5000);
      } else {
        setEmailDomainSuccess('Email domain added. Configure DNS records and verify below.');
        setTimeout(() => setEmailDomainSuccess(null), 5000);
        startEmailPolling();
      }
    } catch (error) {
      setEmailDomainError(error instanceof Error ? error.message : 'Failed to save email domain');
    } finally {
      setEmailDomainSaving(false);
    }
  };

  const handleVerifyEmailDomain = async () => {
    setEmailDomainVerifying(true);
    setEmailDomainError(null);
    try {
      const data = await teamEmailDomainApi.verifyTeamEmailDomain();
      if (data.verified) {
        setEmailDomain((prev) =>
          prev
            ? {
                ...prev,
                status: 'verified',
                dns_records: data.records as EmailDomainData['dns_records'],
              }
            : prev
        );
        setEmailDomainSuccess('Email domain verified successfully!');
        setTimeout(() => setEmailDomainSuccess(null), 5000);
        if (emailPollTimerRef.current) {
          clearInterval(emailPollTimerRef.current);
          setIsEmailPolling(false);
        }
      } else {
        if (data.records) {
          setEmailDomain((prev) =>
            prev ? { ...prev, dns_records: data.records as EmailDomainData['dns_records'] } : prev
          );
        }
        setEmailDomainError(
          'DNS records not fully configured yet. Add all required records and wait for propagation.'
        );
      }
    } catch (error) {
      setEmailDomainError(error instanceof Error ? error.message : 'Failed to verify email domain');
    } finally {
      setEmailDomainVerifying(false);
    }
  };

  const handleDeleteEmailDomain = async () => {
    if (
      !confirm('Remove this email domain? Transactional emails will revert to the default sender.')
    )
      return;
    setEmailDomainDeleting(true);
    setEmailDomainError(null);
    try {
      await teamEmailDomainApi.deleteTeamEmailDomain();
      setEmailDomain(null);
      setEmailDnsExpanded(false);
      setEmailDomainSuccess('Email domain removed.');
      setTimeout(() => setEmailDomainSuccess(null), 3000);
      if (emailPollTimerRef.current) {
        clearInterval(emailPollTimerRef.current);
        setIsEmailPolling(false);
      }
    } catch (error) {
      setEmailDomainError(error instanceof Error ? error.message : 'Failed to remove email domain');
    } finally {
      setEmailDomainDeleting(false);
    }
  };

  const handleSaveFromEmail = async () => {
    if (!fromEmail.trim()) return;
    if (emailDomain && !fromEmail.trim().endsWith(`@${emailDomain.domain}`)) {
      setFromEmailError(`Email must end with @${emailDomain.domain}`);
      return;
    }
    setFromEmailSaving(true);
    setFromEmailError(null);
    setFromEmailSaved(false);
    try {
      await teamEmailDomainApi.setTeamFromEmail(fromEmail.trim());
      setFromEmailSaved(true);
      setTimeout(() => setFromEmailSaved(false), 3000);
    } catch (error) {
      setFromEmailError(error instanceof Error ? error.message : 'Failed to save from email');
    } finally {
      setFromEmailSaving(false);
    }
  };

  // ─── Branding handlers ──────────────────────────────────────────────────────

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaviconUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');
      const data = await brandKitApi.uploadBrandKitFile(formData);
      if (data.url) setFaviconUrl(data.url);
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
      await whitelabelApi.updateWhitelabel({
        hideBranding,
        customFaviconUrl: faviconUrl || null,
        customSiteName: siteName || null,
        customEmailSenderName: emailSenderName || null,
      });
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    } catch (error) {
      setBrandingError(error instanceof Error ? error.message : 'Failed to save branding settings');
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback for non-secure contexts
    }
  };

  return {
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
    setFromEmailSaved,
    fromEmailError,
    setFromEmailError,
    handleSaveFromEmail,
    // Copy
    copiedField,
    handleCopy,
  };
}
