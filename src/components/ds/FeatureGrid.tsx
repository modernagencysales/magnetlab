/** FeatureGrid — Feature grid renderer. Variants: icon-top, icon-left, minimal.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import type { FeatureGridConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

interface FeatureGridProps {
  config: FeatureGridConfig;
  variant: string;
  primaryColor: string;
}

// ─── Variant: Icon Top ────────────────────────────────────────────

function IconTopGrid({ config }: { config: FeatureGridConfig }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {config.features.map((feature, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div
            className="rounded-xl p-6 text-center transition-all hover:-translate-y-1 hover:shadow-lg"
            style={{
              border: '1px solid var(--ds-border)',
              backgroundColor: 'var(--ds-card)',
            }}
          >
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ds-foreground)' }}>
              {feature.title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
              {feature.description}
            </p>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

// ─── Variant: Icon Left ───────────────────────────────────────────

function IconLeftGrid({ config }: { config: FeatureGridConfig }) {
  return (
    <div className="flex flex-col gap-6">
      {config.features.map((feature, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div className="flex items-start gap-4">
            <div className="text-2xl flex-shrink-0">{feature.icon}</div>
            <div>
              <h3 className="text-base font-bold mb-1" style={{ color: 'var(--ds-foreground)' }}>
                {feature.title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
                {feature.description}
              </p>
            </div>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

// ─── Variant: Minimal ─────────────────────────────────────────────

function MinimalGrid({
  config,
  primaryColor,
}: {
  config: FeatureGridConfig;
  primaryColor: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {config.features.map((feature, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div>
            <h3 className="text-base font-semibold mb-1" style={{ color: primaryColor }}>
              {feature.title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
              {feature.description}
            </p>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

const FeatureGrid: React.FC<FeatureGridProps> = ({ config, variant, primaryColor }) => {
  switch (variant) {
    case 'icon-left':
      return <IconLeftGrid config={config} />;
    case 'minimal':
      return <MinimalGrid config={config} primaryColor={primaryColor} />;
    case 'icon-top':
    default:
      return <IconTopGrid config={config} />;
  }
};

export default FeatureGrid;
