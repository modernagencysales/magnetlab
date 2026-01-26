'use client';

import { useEffect } from 'react';

interface CalendlyEmbedProps {
  url: string;
}

export function CalendlyEmbed({ url }: CalendlyEmbedProps) {
  useEffect(() => {
    // Load Calendly widget script
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Ensure URL is properly formatted
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
