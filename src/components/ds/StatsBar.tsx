/** StatsBar — Stats bar renderer. Variants: inline, cards, animated-counters.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import type { StatsBarConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';
import { useScrollReveal } from '@/components/funnel/animations/useScrollReveal';
import { useCountUp } from '@/components/funnel/animations/useCountUp';

// ─── Types ─────────────────────────────────────────────────────────

interface StatsBarProps {
  config: StatsBarConfig;
  variant: string;
  primaryColor: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Parses numeric part from a stat value like "500+", "$1.2M", "99%". */
function parseStatValue(value: string): { prefix: string; number: number; suffix: string } {
  const match = value.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { prefix: '', number: 0, suffix: value };
  return {
    prefix: match[1],
    number: parseFloat(match[2]),
    suffix: match[3],
  };
}

// ─── Variant: Inline ──────────────────────────────────────────────

function InlineStats({ config, primaryColor }: { config: StatsBarConfig; primaryColor: string }) {
  return (
    <ScrollReveal>
      <div
        className="flex flex-wrap justify-center gap-8 py-6"
        style={{
          borderTop: '1px solid var(--ds-border)',
          borderBottom: '1px solid var(--ds-border)',
        }}
      >
        {config.items.map((item, i) => (
          <div key={i} className="text-center px-4">
            <div className="text-2xl font-bold" style={{ color: primaryColor }}>
              {item.value}
            </div>
            <div className="text-sm" style={{ color: 'var(--ds-muted)' }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </ScrollReveal>
  );
}

// ─── Variant: Cards ───────────────────────────────────────────────

function CardStats({ config, primaryColor }: { config: StatsBarConfig; primaryColor: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {config.items.map((item, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div
            className="rounded-xl p-6 text-center transition-transform hover:-translate-y-1"
            style={{
              border: '1px solid var(--ds-border)',
              backgroundColor: 'var(--ds-card)',
            }}
          >
            <div className="text-2xl font-bold" style={{ color: primaryColor }}>
              {item.value}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--ds-muted)' }}>
              {item.label}
            </div>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

// ─── Variant: Animated Counters ───────────────────────────────────

function AnimatedCounterItem({
  item,
  primaryColor,
  isVisible,
  delay,
}: {
  item: { value: string; label: string };
  primaryColor: string;
  isVisible: boolean;
  delay: number;
}) {
  const parsed = parseStatValue(item.value);
  const count = useCountUp(parsed.number, isVisible);

  return (
    <div
      className="text-center px-4"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="text-2xl font-bold" style={{ color: primaryColor }}>
        {parsed.prefix}
        {Number.isInteger(parsed.number) ? count : count.toFixed(1)}
        {parsed.suffix}
      </div>
      <div className="text-sm" style={{ color: 'var(--ds-muted)' }}>
        {item.label}
      </div>
    </div>
  );
}

function AnimatedCounterStats({
  config,
  primaryColor,
}: {
  config: StatsBarConfig;
  primaryColor: string;
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className="flex flex-wrap justify-center gap-8 py-6"
      style={{
        borderTop: '1px solid var(--ds-border)',
        borderBottom: '1px solid var(--ds-border)',
      }}
    >
      {config.items.map((item, i) => (
        <AnimatedCounterItem
          key={i}
          item={item}
          primaryColor={primaryColor}
          isVisible={isVisible}
          delay={i * 150}
        />
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

const StatsBar: React.FC<StatsBarProps> = ({ config, variant, primaryColor }) => {
  switch (variant) {
    case 'cards':
      return <CardStats config={config} primaryColor={primaryColor} />;
    case 'animated-counters':
      return <AnimatedCounterStats config={config} primaryColor={primaryColor} />;
    case 'inline':
    default:
      return <InlineStats config={config} primaryColor={primaryColor} />;
  }
};

export default StatsBar;
