/** HeroSection — Hero section renderer. Variants: centered, split-image, full-bleed-gradient.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import Image from 'next/image';
import type { HeroConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

interface HeroSectionProps {
  config: HeroConfig;
  variant: string;
  primaryColor: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function buildGradientBackground(
  gradientConfig: HeroConfig['gradientConfig'],
  primaryColor: string
): string {
  if (!gradientConfig) {
    return `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`;
  }
  const direction = gradientConfig.direction || '135deg';
  return `linear-gradient(${direction}, ${gradientConfig.from}, ${gradientConfig.to})`;
}

// ─── CTA Button ────────────────────────────────────────────────────

function CTALink({ text, url, style }: { text: string; url: string; style: 'solid' | 'glass' }) {
  const isExternal = url.startsWith('http://') || url.startsWith('https://');

  const solidClasses =
    'inline-block px-8 py-3 text-white font-semibold rounded-lg transition-transform hover:-translate-y-0.5';
  const glassClasses =
    'inline-block px-8 py-3 text-white font-semibold rounded-lg bg-white/20 backdrop-blur-sm transition-transform hover:-translate-y-0.5';

  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className={style === 'glass' ? glassClasses : solidClasses}
      style={style === 'solid' ? { backgroundColor: 'var(--ds-primary)' } : undefined}
    >
      {text}
    </a>
  );
}

// ─── Variant: Centered ────────────────────────────────────────────

function CenteredHero({ config }: { config: HeroConfig }) {
  return (
    <ScrollReveal>
      <div className="text-center py-12 sm:py-16">
        <h1
          className="text-3xl sm:text-5xl font-bold mb-4"
          style={{ color: 'var(--ds-foreground)' }}
        >
          {config.headline}
        </h1>
        {config.subline && (
          <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: 'var(--ds-muted)' }}>
            {config.subline}
          </p>
        )}
        {config.ctaText && config.ctaUrl && (
          <CTALink text={config.ctaText} url={config.ctaUrl} style="solid" />
        )}
      </div>
    </ScrollReveal>
  );
}

// ─── Variant: Split Image ─────────────────────────────────────────

function SplitImageHero({ config }: { config: HeroConfig }) {
  return (
    <ScrollReveal>
      <div className="flex flex-col md:flex-row items-center gap-8 py-12">
        <div className="flex-1">
          <h1
            className="text-3xl sm:text-5xl font-bold mb-4"
            style={{ color: 'var(--ds-foreground)' }}
          >
            {config.headline}
          </h1>
          {config.subline && (
            <p className="text-lg mb-8" style={{ color: 'var(--ds-muted)' }}>
              {config.subline}
            </p>
          )}
          {config.ctaText && config.ctaUrl && (
            <CTALink text={config.ctaText} url={config.ctaUrl} style="solid" />
          )}
        </div>
        {config.backgroundImageUrl && (
          <div className="flex-1 relative max-h-80">
            <Image
              src={config.backgroundImageUrl}
              alt=""
              width={600}
              height={320}
              className="rounded-xl max-h-80 w-full object-cover"
              unoptimized
            />
          </div>
        )}
      </div>
    </ScrollReveal>
  );
}

// ─── Variant: Full Bleed Gradient ─────────────────────────────────

function FullBleedGradientHero({
  config,
  primaryColor,
}: {
  config: HeroConfig;
  primaryColor: string;
}) {
  const background = buildGradientBackground(config.gradientConfig, primaryColor);

  return (
    <ScrollReveal>
      <div
        className="rounded-2xl overflow-hidden px-6 sm:px-12 py-12 sm:py-16 text-center"
        style={{
          background,
          backgroundSize: '200% 200%',
          animation: 'gradientShift 8s ease infinite',
        }}
      >
        <h1 className="text-3xl sm:text-5xl font-bold mb-4 text-white">{config.headline}</h1>
        {config.subline && (
          <p className="text-lg max-w-2xl mx-auto mb-8 text-white/80">{config.subline}</p>
        )}
        {config.ctaText && config.ctaUrl && (
          <CTALink text={config.ctaText} url={config.ctaUrl} style="glass" />
        )}
      </div>
    </ScrollReveal>
  );
}

// ─── Main Component ───────────────────────────────────────────────

const HeroSection: React.FC<HeroSectionProps> = ({ config, variant, primaryColor }) => {
  switch (variant) {
    case 'split-image':
      return <SplitImageHero config={config} />;
    case 'full-bleed-gradient':
      return <FullBleedGradientHero config={config} primaryColor={primaryColor} />;
    case 'centered':
    default:
      return <CenteredHero config={config} />;
  }
};

export default HeroSection;
