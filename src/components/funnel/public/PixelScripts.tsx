'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export function sanitizePixelId(id: string | undefined): string {
  if (!id) return '';
  return id.replace(/[^0-9]/g, '');
}

export function sanitizePartnerId(id: string | undefined): string {
  if (!id) return '';
  return id.replace(/[^a-zA-Z0-9]/g, '');
}

export interface PixelConfig {
  meta?: {
    pixelId: string;
    enabledEvents: string[];
  };
  linkedin?: {
    partnerId: string;
    enabledEvents: string[];
  };
}

interface PixelScriptsProps {
  config: PixelConfig;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    lintrk?: (...args: unknown[]) => void;
    _linkedin_data_partner_ids?: string[];
  }
}

export function PixelScripts({ config }: PixelScriptsProps) {
  // Fire PageView on mount
  useEffect(() => {
    if (config.meta?.pixelId && config.meta.enabledEvents.includes('PageView')) {
      if (window.fbq) {
        window.fbq('track', 'PageView');
      }
    }
  }, [config.meta]);

  useEffect(() => {
    if (config.linkedin?.partnerId && config.linkedin.enabledEvents.includes('PageView')) {
      if (window.lintrk) {
        window.lintrk('track', { conversion_id: config.linkedin.partnerId });
      }
    }
  }, [config.linkedin]);

  return (
    <>
      {/* Meta Pixel */}
      {config.meta?.pixelId && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${sanitizePixelId(config.meta.pixelId)}');
            `,
          }}
        />
      )}

      {/* LinkedIn Insight Tag */}
      {config.linkedin?.partnerId && (
        <Script
          id="linkedin-insight"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              _linkedin_partner_id = "${sanitizePartnerId(config.linkedin.partnerId)}";
              window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
              window._linkedin_data_partner_ids.push(_linkedin_partner_id);
              (function(l) {
                if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
                window.lintrk.q=[]}
                var s = document.getElementsByTagName("script")[0];
                var b = document.createElement("script");
                b.type = "text/javascript";b.async = true;
                b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
                s.parentNode.insertBefore(b, s);})(window.lintrk);
            `,
          }}
        />
      )}
    </>
  );
}

/**
 * Fire a client-side Lead event for deduplication with server-side CAPI.
 * Uses the leadId as event_id so Meta/LinkedIn can deduplicate.
 */
export function fireClientLeadEvent(
  config: PixelConfig,
  leadId: string,
  contentName?: string
) {
  if (config.meta?.pixelId && config.meta.enabledEvents.includes('Lead')) {
    if (window.fbq) {
      const eventParams: Record<string, unknown> = {};
      if (contentName) eventParams.content_name = contentName;
      window.fbq('track', 'Lead', eventParams, { eventID: leadId });
    }
  }

  if (config.linkedin?.partnerId && config.linkedin.enabledEvents.includes('Lead')) {
    if (window.lintrk) {
      window.lintrk('track', { conversion_id: config.linkedin.partnerId });
    }
  }
}
