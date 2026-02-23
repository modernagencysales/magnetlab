'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        session_recording: {
          maskAllInputs: false,
          maskInputOptions: {
            password: true,
          },
          // Prevent SecurityError when rrweb tries to observe cross-origin iframes
          // (YouTube, Vimeo, Loom, Calendly, Cal.com embeds)
          recordCrossOriginIframes: false,
          blockSelector: 'iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"], iframe[src*="loom.com"], iframe[src*="calendly.com"], iframe[src*="cal.com"]',
        },
      });
    }
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
