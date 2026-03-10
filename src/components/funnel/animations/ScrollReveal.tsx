/** ScrollReveal — Wrapper component for fade+slide-up animation on scroll.
 * Uses useScrollReveal internally. Never imports Next.js server modules. */
'use client';

import React, { type ReactNode } from 'react';

import { useScrollReveal } from './useScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────

export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
