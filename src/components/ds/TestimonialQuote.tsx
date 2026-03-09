/** TestimonialQuote — Testimonial section renderer. Variants: quote-card (default), highlight, avatar.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React from 'react';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

interface TestimonialQuoteProps {
  quote: string;
  author?: string;
  role?: string;
  result?: string;
  variant?: string;
  primaryColor?: string;
  className?: string;
}

// ─── Variant: quote-card (default) ─────────────────────────────────

function QuoteCard({
  quote,
  author,
  role,
  result,
}: {
  quote: string;
  author: string;
  role: string;
  result?: string;
}) {
  return (
    <div
      className="rounded-xl border shadow-sm p-6 sm:p-8"
      style={{
        backgroundColor: 'var(--ds-card)',
        borderColor: 'var(--ds-border)',
        borderLeftWidth: '4px',
        borderLeftColor: 'var(--ds-primary)',
      }}
    >
      <blockquote
        className="text-lg sm:text-xl leading-relaxed mb-6 italic"
        style={{ color: 'var(--ds-text)' }}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="font-semibold" style={{ color: 'var(--ds-text)' }}>
            {author}
          </p>
          {role && (
            <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
              {role}
            </p>
          )}
        </div>
        {result && (
          <div
            className="rounded-lg px-4 py-2"
            style={{
              backgroundColor: 'var(--ds-primary-light)',
              border: `1px solid var(--ds-primary-light)`,
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--ds-primary)' }}>
              {result}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Variant: highlight ────────────────────────────────────────────

function HighlightQuote({
  quote,
  author,
  role,
  result,
}: {
  quote: string;
  author: string;
  role: string;
  result?: string;
}) {
  return (
    <div className="text-center py-6 sm:py-10">
      <blockquote
        className="text-2xl sm:text-3xl md:text-4xl leading-relaxed mb-8 italic font-light"
        style={{ color: 'var(--ds-text)' }}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="space-y-1">
        <p className="font-semibold text-lg" style={{ color: 'var(--ds-text)' }}>
          {author}
        </p>
        {role && (
          <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
            {role}
          </p>
        )}
        {result && (
          <p className="text-sm font-semibold mt-3" style={{ color: 'var(--ds-primary)' }}>
            {result}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Variant: avatar ───────────────────────────────────────────────

function AvatarQuote({
  quote,
  author,
  role,
  result,
  primaryColor,
}: {
  quote: string;
  author: string;
  role: string;
  result?: string;
  primaryColor: string;
}) {
  const initials = author
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-6"
        style={{ backgroundColor: primaryColor }}
      >
        {initials}
      </div>
      <blockquote
        className="text-lg sm:text-xl leading-relaxed mb-6 italic max-w-2xl"
        style={{ color: 'var(--ds-text)' }}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="space-y-1">
        <p className="font-semibold" style={{ color: 'var(--ds-text)' }}>
          {author}
        </p>
        {role && (
          <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
            {role}
          </p>
        )}
        {result && (
          <p className="text-sm font-semibold mt-3" style={{ color: 'var(--ds-primary)' }}>
            {result}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

const TestimonialQuote: React.FC<TestimonialQuoteProps> = ({
  quote,
  author = 'Recent Client',
  role = '',
  result,
  variant = 'default',
  primaryColor = '#6366f1',
  className = '',
}) => {
  function renderVariant() {
    switch (variant) {
      case 'highlight':
        return <HighlightQuote quote={quote} author={author} role={role} result={result} />;
      case 'avatar':
        return (
          <AvatarQuote
            quote={quote}
            author={author}
            role={role}
            result={result}
            primaryColor={primaryColor}
          />
        );
      default:
        return <QuoteCard quote={quote} author={author} role={role} result={result} />;
    }
  }

  return (
    <ScrollReveal>
      <div className={`max-w-3xl mx-auto ${className}`}>{renderVariant()}</div>
    </ScrollReveal>
  );
};

export default TestimonialQuote;
