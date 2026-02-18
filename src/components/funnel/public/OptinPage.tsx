'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getThemeVars } from '@/lib/utils/theme-vars';
import { CTAButton, SectionRenderer } from '@/components/ds';
import { PixelScripts, fireClientLeadEvent, type PixelConfig } from './PixelScripts';
import { FontLoader, getFontStyle } from './FontLoader';
import type { FunnelPageSection } from '@/lib/types/funnel';

interface OptinPageProps {
  funnelId: string;
  headline: string;
  subline: string | null;
  buttonText: string;
  socialProof: string | null;
  username: string;
  slug: string;
  theme?: 'dark' | 'light';
  primaryColor?: string;
  backgroundStyle?: 'solid' | 'gradient' | 'pattern';
  logoUrl?: string | null;
  sections?: FunnelPageSection[];
  pixelConfig?: PixelConfig;
  leadMagnetTitle?: string | null;
  fontFamily?: string | null;
  fontUrl?: string | null;
  hideBranding?: boolean;
  redirectTrigger?: 'none' | 'immediate' | 'after_qualification';
  redirectUrl?: string | null;
}

export function OptinPage({
  funnelId,
  headline,
  subline,
  buttonText,
  socialProof,
  username,
  slug,
  theme = 'dark',
  primaryColor = '#8b5cf6',
  backgroundStyle = 'solid',
  logoUrl,
  sections = [],
  pixelConfig,
  leadMagnetTitle,
  fontFamily,
  fontUrl,
  hideBranding,
  redirectTrigger = 'none',
  redirectUrl,
}: OptinPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themeVars = getThemeVars(theme, primaryColor);
  const isDark = theme === 'dark';

  // Background style
  const getBackgroundStyle = (): string => {
    const bgColor = isDark ? '#09090B' : '#FAFAFA';
    if (backgroundStyle === 'gradient') {
      return isDark
        ? `linear-gradient(135deg, ${bgColor} 0%, #18181B 50%, ${bgColor} 100%)`
        : `linear-gradient(135deg, ${bgColor} 0%, #FFFFFF 50%, ${bgColor} 100%)`;
    }
    if (backgroundStyle === 'pattern') {
      return `radial-gradient(circle at 50% 50%, ${primaryColor}15 0%, transparent 50%), ${bgColor}`;
    }
    return bgColor;
  };

  // Split sections into above-form and below-form
  const aboveSections = sections.filter(s => s.sortOrder < 50);
  const belowSections = sections.filter(s => s.sortOrder >= 50);

  // Track page view on mount
  useEffect(() => {
    fetch('/api/public/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funnelPageId: funnelId }),
    }).catch(() => {});
  }, [funnelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setError(null);

    try {
      // Read Meta cookies for CAPI match rate
      const cookies = document.cookie.split(';').reduce((acc, c) => {
        const [k, v] = c.trim().split('=');
        if (k) acc[k] = v || '';
        return acc;
      }, {} as Record<string, string>);

      const response = await fetch('/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email,
          utmSource: searchParams.get('utm_source') || undefined,
          utmMedium: searchParams.get('utm_medium') || undefined,
          utmCampaign: searchParams.get('utm_campaign') || undefined,
          fbc: cookies['_fbc'] || undefined,
          fbp: cookies['_fbp'] || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      const { leadId } = await response.json();

      // Fire client-side lead event for dedup with server-side CAPI
      if (pixelConfig) {
        fireClientLeadEvent(pixelConfig, leadId, leadMagnetTitle || undefined);
      }

      // Redirect based on configuration
      if (redirectTrigger === 'immediate' && redirectUrl) {
        const url = new URL(redirectUrl);
        url.searchParams.set('leadId', leadId);
        url.searchParams.set('email', email);
        window.location.href = url.toString();
      } else {
        router.push(`/p/${username}/${slug}/thankyou?leadId=${leadId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    {pixelConfig && <PixelScripts config={pixelConfig} />}
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: getBackgroundStyle(), ...themeVars, ...getFontStyle(fontFamily) }}
    >
      <FontLoader fontFamily={fontFamily || null} fontUrl={fontUrl || null} />
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo */}
        {logoUrl && (
          <Image src={logoUrl} alt="Logo" width={120} height={48} className="h-12 w-auto mx-auto" unoptimized />
        )}

        {/* Headline */}
        <h1
          className="text-3xl md:text-4xl font-semibold leading-tight"
          style={{ color: 'var(--ds-text)' }}
        >
          {headline}
        </h1>

        {/* Subline */}
        {subline && (
          <p className="text-lg leading-relaxed" style={{ color: 'var(--ds-muted)' }}>
            {subline}
          </p>
        )}

        {/* Above-form sections */}
        {aboveSections.length > 0 && (
          <div className="space-y-6 text-left">
            {aboveSections.map(s => <SectionRenderer key={s.id} section={s} />)}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email..."
            required
            aria-label="Email address"
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: 'var(--ds-bg)',
              border: '1px solid var(--ds-border)',
              color: 'var(--ds-text)',
            }}
          />

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="w-full">
            {submitting ? (
              <button
                type="submit"
                disabled
                className="w-full rounded-lg px-4 py-3 text-sm font-medium text-white opacity-50 flex items-center justify-center gap-2"
                style={{ background: primaryColor }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {buttonText}
              </button>
            ) : (
              <CTAButton
                text={buttonText}
                type="submit"
                icon="arrow"
                className="w-full"
                disabled={!email}
              />
            )}
          </div>
        </form>

        {/* Below-form sections */}
        {belowSections.length > 0 && (
          <div className="space-y-6 text-left">
            {belowSections.map(s => <SectionRenderer key={s.id} section={s} />)}
          </div>
        )}

        {/* Social Proof */}
        {socialProof && (
          <p className="text-sm" style={{ color: 'var(--ds-placeholder)' }}>
            {socialProof}
          </p>
        )}
      </div>

      {/* Powered by */}
      {!hideBranding && (
        <div className="mt-12">
          <a
            href="https://magnetlab.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--ds-placeholder)' }}
          >
            Powered by MagnetLab
          </a>
        </div>
      )}
    </div>
    </>
  );
}
