'use client';

import { useEffect } from 'react';

interface CalendlyEmbedProps {
  url: string;
}

type EmbedType = 'calendly' | 'cal' | 'iclosed' | 'unknown';

function detectEmbedType(url: string): EmbedType {
  if (url.includes('calendly.com') || url.includes('calendly/')) {
    return 'calendly';
  }
  if (url.includes('iclosed.io') || url.includes('iclosed.com')) {
    return 'iclosed';
  }
  if (url.includes('cal.com') || url.includes('cal/')) {
    return 'cal';
  }
  return 'unknown';
}

// Build Cal.com embed URL
function getCalEmbedUrl(url: string): string {
  // Ensure it's a full URL
  let fullUrl = url;
  if (!url.startsWith('https://')) {
    fullUrl = `https://cal.com/${url}`;
  }

  // Add embed parameters
  const separator = fullUrl.includes('?') ? '&' : '?';
  return `${fullUrl}${separator}embed=true&theme=dark&hideEventTypeDetails=false`;
}

export function CalendlyEmbed({ url }: CalendlyEmbedProps) {
  const embedType = detectEmbedType(url);

  useEffect(() => {
    if (embedType === 'calendly') {
      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) {
        return;
      }

      // Load Calendly widget script
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }

    if (embedType === 'iclosed') {
      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://app.iclosed.io/assets/widget.js"]');
      if (existingScript) {
        return;
      }

      // Load iClosed widget script
      const script = document.createElement('script');
      script.src = 'https://app.iclosed.io/assets/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [embedType]);

  if (embedType === 'calendly') {
    const calendlyUrl = url.startsWith('https://') ? url : `https://calendly.com/${url}`;
    return (
      <div
        className="calendly-inline-widget rounded-xl overflow-hidden"
        data-url={`${calendlyUrl}?background_color=18181b&text_color=fafafa&primary_color=8b5cf6`}
        style={{
          minWidth: '320px',
          height: '630px',
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
        }}
      />
    );
  }

  if (embedType === 'iclosed') {
    return (
      <div
        className="iclosed-widget"
        data-url={url}
        title="Book a Call"
        style={{
          width: '100%',
          height: '620px',
        }}
      />
    );
  }

  if (embedType === 'cal') {
    const embedUrl = getCalEmbedUrl(url);
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          minWidth: '320px',
          height: '700px',
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
        }}
      >
        <iframe
          src={embedUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="Book a Call"
          allow="camera; microphone; payment"
        />
      </div>
    );
  }

  // Fallback for unknown URL type - try iframe
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        minWidth: '320px',
        height: '630px',
        background: '#18181B',
        border: '1px solid #27272A',
        borderRadius: '12px',
      }}
    >
      <iframe
        src={url}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title="Booking Calendar"
      />
    </div>
  );
}
