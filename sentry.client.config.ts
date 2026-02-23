import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
  ],

  // Tunnel to avoid ad blockers
  tunnel: '/api/monitoring',

  // Filter out known third-party errors that we can't fix
  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || '';
    const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];

    // PostHog/rrweb SecurityError when cleaning up cross-origin iframe listeners
    // See: https://github.com/PostHog/posthog-js/issues/2533
    if (
      message.includes('removeEventListener') &&
      message.includes('security policy') &&
      frames.some((f) => f.filename?.includes('posthog-recorder'))
    ) {
      return null;
    }

    return event;
  },
});
