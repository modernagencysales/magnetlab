/** SimpleSteps — Steps section renderer. Variants: numbered (default), timeline, icon-cards.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

interface Step {
  title: string;
  description: string;
  icon?: string;
}

interface SimpleStepsProps {
  heading?: string;
  subheading?: string;
  steps?: Step[];
  variant?: string;
  primaryColor?: string;
  className?: string;
}

// ─── Defaults ──────────────────────────────────────────────────────

const DEFAULT_STEPS: Step[] = [
  {
    title: 'Book a 30-Min Call',
    description: "We'll review your blueprint together and identify your 3 quickest wins.",
  },
  {
    title: 'Get Your Implementation Plan',
    description: 'Walk away with a concrete 30-day action plan you can start today.',
  },
  {
    title: 'See Results in 30 Days',
    description: 'Most clients see their first inbound lead within 2-4 weeks of implementing.',
  },
];

// ─── Variant: numbered (default) ───────────────────────────────────

function NumberedSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {steps.map((step, i) => (
        <div key={i} className="text-center">
          <div
            className="text-5xl sm:text-6xl font-bold mb-3"
            style={{ color: 'var(--ds-primary)', opacity: 0.3 }}
          >
            {String(i + 1).padStart(2, '0')}
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ds-text)' }}>
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ds-muted)' }}>
            {step.description}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Variant: timeline ─────────────────────────────────────────────

function TimelineSteps({ steps, primaryColor }: { steps: Step[]; primaryColor: string }) {
  return (
    <div className="relative max-w-2xl mx-auto pl-8 sm:pl-12">
      {/* Vertical dotted line */}
      <div
        className="absolute left-3 sm:left-5 top-2 bottom-2 w-px"
        style={{
          borderLeft: `2px dotted var(--ds-border)`,
        }}
      />

      <div className="space-y-10">
        {steps.map((step, i) => (
          <div key={i} className="relative">
            {/* Step circle */}
            <div
              className="absolute -left-5 sm:-left-7 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {i + 1}
            </div>

            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--ds-text)' }}>
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ds-muted)' }}>
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Variant: icon-cards ───────────────────────────────────────────

function IconCardSteps({ steps, primaryColor }: { steps: Step[]; primaryColor: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {steps.map((step, i) => (
        <div
          key={i}
          className="rounded-xl p-6 text-center"
          style={{
            backgroundColor: 'var(--ds-card)',
            border: '1px solid var(--ds-border)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl"
            style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
          >
            {step.icon || String(i + 1)}
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ds-text)' }}>
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ds-muted)' }}>
            {step.description}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

const SimpleSteps: React.FC<SimpleStepsProps> = ({
  heading = 'What Happens Next',
  subheading = "Here's exactly what to expect when you book your strategy call.",
  steps = DEFAULT_STEPS,
  variant = 'default',
  primaryColor = '#6366f1',
  className = '',
}) => {
  function renderSteps() {
    switch (variant) {
      case 'timeline':
        return <TimelineSteps steps={steps} primaryColor={primaryColor} />;
      case 'icon-cards':
        return <IconCardSteps steps={steps} primaryColor={primaryColor} />;
      default:
        return <NumberedSteps steps={steps} />;
    }
  }

  return (
    <ScrollReveal>
      <div
        className={`py-12 sm:py-16 px-4 ${className}`}
        style={{ background: `linear-gradient(to bottom, var(--ds-primary-light), transparent)` }}
      >
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl sm:text-3xl font-bold text-center mb-3"
            style={{ color: 'var(--ds-text)' }}
          >
            {heading}
          </h2>
          <p className="text-center mb-10 max-w-2xl mx-auto" style={{ color: 'var(--ds-muted)' }}>
            {subheading}
          </p>
          {renderSteps()}
        </div>
      </div>
    </ScrollReveal>
  );
};

export default SimpleSteps;
