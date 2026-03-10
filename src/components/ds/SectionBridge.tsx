/** SectionBridge — Section bridge renderer. Variant prop exposed, falls back to config.variant.
 * Variant mapping: divider → default, accent-bar → accent, gradient-fade → gradient.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

type InternalVariant = 'default' | 'accent' | 'gradient';

interface SectionBridgeProps {
  text: string;
  variant?: string;
  primaryColor?: string;
  stepNumber?: number;
  stepLabel?: string;
  className?: string;
}

// ─── Variant mapping ───────────────────────────────────────────────

const VARIANT_ALIAS: Record<string, InternalVariant> = {
  divider: 'default',
  'accent-bar': 'accent',
  'gradient-fade': 'gradient',
};

function resolveVariant(variant: string | undefined): InternalVariant {
  if (!variant || variant === 'default') return 'default';
  if (variant in VARIANT_ALIAS) return VARIANT_ALIAS[variant];
  if (variant === 'accent' || variant === 'gradient') return variant;
  return 'default';
}

// ─── Component ─────────────────────────────────────────────────────

const SectionBridge: React.FC<SectionBridgeProps> = ({
  text,
  variant,
  // primaryColor accepted for consistency but not used
  stepNumber,
  stepLabel,
  className = '',
}) => {
  const resolved = resolveVariant(variant);

  const variantStyles: Record<InternalVariant, string> = {
    default: '',
    accent: 'border-y border-zinc-200 dark:border-zinc-800',
    gradient: 'border-t border-zinc-200 dark:border-zinc-800',
  };

  const variantInline: React.CSSProperties =
    resolved === 'accent'
      ? { backgroundColor: 'var(--ds-primary-light)' }
      : resolved === 'gradient'
        ? { background: `linear-gradient(to bottom, var(--ds-primary-light), transparent)` }
        : { backgroundColor: 'var(--ds-bg)' };

  return (
    <ScrollReveal>
      <div
        className={`py-14 sm:py-20 px-4 ${variantStyles[resolved]} ${className}`}
        style={variantInline}
      >
        <div className="max-w-3xl mx-auto text-center space-y-4">
          {stepNumber != null && (
            <div className="flex items-center justify-center gap-3 mb-2">
              <div
                className="h-px flex-1 max-w-[60px]"
                style={{ backgroundColor: 'var(--ds-border)' }}
              />
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                style={{
                  backgroundColor: 'var(--ds-primary-light)',
                  color: 'var(--ds-primary)',
                }}
              >
                Step {stepNumber}
                {stepLabel && <span className="font-semibold">&mdash; {stepLabel}</span>}
              </span>
              <div
                className="h-px flex-1 max-w-[60px]"
                style={{ backgroundColor: 'var(--ds-border)' }}
              />
            </div>
          )}

          <p
            className="text-xl sm:text-2xl md:text-3xl leading-relaxed font-light"
            style={{ color: 'var(--ds-body)' }}
          >
            {text}
          </p>
        </div>
      </div>
    </ScrollReveal>
  );
};

export default SectionBridge;
