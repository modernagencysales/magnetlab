/** LogoBar — Logo bar section renderer. Variants: inline (default), grid.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

interface LogoBarLogo {
  name: string;
  imageUrl: string;
}

interface LogoBarProps {
  logos: LogoBarLogo[];
  variant?: string;
  primaryColor?: string;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────

const LogoBar: React.FC<LogoBarProps> = ({
  logos,
  variant = 'default',
  // primaryColor accepted for consistency but not used
  className = '',
}) => {
  const validLogos = logos.filter((logo) => logo.imageUrl);
  if (validLogos.length === 0) return null;

  const logoItems = validLogos.map((logo, i) => (
    <div key={i} className="flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.imageUrl}
        alt={logo.name}
        className="h-8 sm:h-10 w-auto object-contain opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-200"
      />
    </div>
  ));

  return (
    <ScrollReveal>
      <div className={`py-8 ${className}`}>
        <p
          className="text-xs font-medium uppercase tracking-widest text-center mb-6"
          style={{ color: 'var(--ds-muted)' }}
        >
          Trusted by leaders at
        </p>

        {variant === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-center justify-items-center max-w-3xl mx-auto">
            {logoItems}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10">
            {logoItems}
          </div>
        )}
      </div>
    </ScrollReveal>
  );
};

export default LogoBar;
