/** SocialProofWall — Social proof wall renderer. Variants: grid, carousel, stacked.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import Image from 'next/image';
import type { SocialProofWallConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

interface SocialProofWallProps {
  config: SocialProofWallConfig;
  variant: string;
  primaryColor: string;
}

// ─── Shared: Author Info ──────────────────────────────────────────

function AuthorInfo({ author, role, avatar }: { author: string; role?: string; avatar?: string }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      {avatar && (
        <Image
          src={avatar}
          alt={author}
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover"
          unoptimized
        />
      )}
      <div>
        <div className="text-sm font-semibold" style={{ color: 'var(--ds-foreground)' }}>
          {author}
        </div>
        {role && (
          <div className="text-xs" style={{ color: 'var(--ds-muted)' }}>
            {role}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Variant: Grid ────────────────────────────────────────────────

function GridProof({ config }: { config: SocialProofWallConfig }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {config.testimonials.map((testimonial, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div
            className="rounded-xl p-6 transition-transform hover:-translate-y-1"
            style={{
              border: '1px solid var(--ds-border)',
              backgroundColor: 'var(--ds-card)',
            }}
          >
            <p className="text-sm italic" style={{ color: 'var(--ds-foreground)' }}>
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <AuthorInfo
              author={testimonial.author}
              role={testimonial.role}
              avatar={testimonial.avatar}
            />
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

// ─── Variant: Carousel ────────────────────────────────────────────

function CarouselProof({ config }: { config: SocialProofWallConfig }) {
  return (
    <ScrollReveal>
      <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {config.testimonials.map((testimonial, i) => (
            <div
              key={i}
              className="w-72 flex-shrink-0 snap-center rounded-xl p-6"
              style={{
                border: '1px solid var(--ds-border)',
                backgroundColor: 'var(--ds-card)',
              }}
            >
              <p className="text-sm italic" style={{ color: 'var(--ds-foreground)' }}>
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <AuthorInfo
                author={testimonial.author}
                role={testimonial.role}
                avatar={testimonial.avatar}
              />
            </div>
          ))}
        </div>
      </div>
    </ScrollReveal>
  );
}

// ─── Variant: Stacked ─────────────────────────────────────────────

function StackedProof({
  config,
  primaryColor,
}: {
  config: SocialProofWallConfig;
  primaryColor: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {config.testimonials.map((testimonial, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div className="pl-5 py-3" style={{ borderLeft: `4px solid ${primaryColor}` }}>
            <p className="text-sm italic" style={{ color: 'var(--ds-foreground)' }}>
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <AuthorInfo
              author={testimonial.author}
              role={testimonial.role}
              avatar={testimonial.avatar}
            />
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

const SocialProofWall: React.FC<SocialProofWallProps> = ({ config, variant, primaryColor }) => {
  switch (variant) {
    case 'carousel':
      return <CarouselProof config={config} />;
    case 'stacked':
      return <StackedProof config={config} primaryColor={primaryColor} />;
    case 'grid':
    default:
      return <GridProof config={config} />;
  }
};

export default SocialProofWall;
