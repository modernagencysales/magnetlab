'use client';

import { useEffect } from 'react';
import { buildIClosedUrl } from '@/lib/utils/iclosed-helpers';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BookingPrefillData {
  leadName?: string | null;
  leadEmail?: string | null;
  surveyAnswers?: Record<string, string>;
}

interface CalendlyEmbedProps {
  url: string;
  prefillData?: BookingPrefillData;
}

type EmbedType = 'calendly' | 'cal' | 'iclosed' | 'unknown';

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectEmbedType(url: string): EmbedType {
  if (url.includes('calendly.com') || url.includes('calendly/')) return 'calendly';
  if (url.includes('iclosed.io') || url.includes('iclosed.com')) return 'iclosed';
  if (url.includes('cal.com') || url.includes('cal/')) return 'cal';
  return 'unknown';
}

function getCalEmbedUrl(url: string, prefill?: BookingPrefillData): string {
  let fullUrl = url;
  if (!url.startsWith('https://')) fullUrl = `https://cal.com/${url}`;

  try {
    const parsed = new URL(fullUrl);
    parsed.searchParams.set('embed', 'true');
    parsed.searchParams.set('theme', 'dark');
    parsed.searchParams.set('hideEventTypeDetails', 'false');
    if (prefill?.leadName) parsed.searchParams.set('name', prefill.leadName);
    if (prefill?.leadEmail) parsed.searchParams.set('email', prefill.leadEmail);
    return parsed.toString();
  } catch {
    const separator = fullUrl.includes('?') ? '&' : '?';
    return `${fullUrl}${separator}embed=true&theme=dark&hideEventTypeDetails=false`;
  }
}

function getCalendlyUrl(url: string, prefill?: BookingPrefillData): string {
  const calendlyUrl = url.startsWith('https://') ? url : `https://calendly.com/${url}`;

  try {
    const parsed = new URL(calendlyUrl);
    parsed.searchParams.set('background_color', '18181b');
    parsed.searchParams.set('text_color', 'fafafa');
    parsed.searchParams.set('primary_color', '8b5cf6');
    if (prefill?.leadName) parsed.searchParams.set('name', prefill.leadName);
    if (prefill?.leadEmail) parsed.searchParams.set('email', prefill.leadEmail);
    return parsed.toString();
  } catch {
    return `${calendlyUrl}?background_color=18181b&text_color=fafafa&primary_color=8b5cf6`;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CalendlyEmbed({ url, prefillData }: CalendlyEmbedProps) {
  const embedType = detectEmbedType(url);

  useEffect(() => {
    if (embedType === 'calendly') {
      const existing = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://assets.calendly.com/assets/external/widget.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    if (embedType === 'iclosed') {
      const existing = document.querySelector('script[src="https://app.iclosed.io/assets/widget.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://app.iclosed.io/assets/widget.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [embedType]);

  if (embedType === 'calendly') {
    return (
      <div
        className="calendly-inline-widget rounded-xl overflow-hidden"
        data-url={getCalendlyUrl(url, prefillData)}
        style={{ minWidth: '320px', height: '630px', background: '#18181B', border: '1px solid #27272A', borderRadius: '12px' }}
      />
    );
  }

  if (embedType === 'iclosed') {
    const resolvedUrl = prefillData
      ? buildIClosedUrl(url, {
          leadName: prefillData.leadName,
          leadEmail: prefillData.leadEmail,
          surveyAnswers: prefillData.surveyAnswers,
        })
      : url;

    return (
      <div
        className="iclosed-widget"
        data-url={resolvedUrl}
        title="Book a Call"
        style={{ width: '100%', height: '620px' }}
      />
    );
  }

  if (embedType === 'cal') {
    return (
      <div className="rounded-xl overflow-hidden" style={{ minWidth: '320px', height: '700px', background: '#18181B', border: '1px solid #27272A', borderRadius: '12px' }}>
        <iframe
          src={getCalEmbedUrl(url, prefillData)}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Book a Call"
          allow="camera; microphone; payment"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ minWidth: '320px', height: '630px', background: '#18181B', border: '1px solid #27272A', borderRadius: '12px' }}>
      <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title="Booking Calendar" />
    </div>
  );
}
