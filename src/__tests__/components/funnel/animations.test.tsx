/** Animation hooks + components tests.
 * Mocks IntersectionObserver and matchMedia for JSDOM environment. */
import React from 'react';
import { render, screen } from '@testing-library/react';

import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── IntersectionObserver mock ─────────────────────────────────────

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

let lastObserverCallback: IntersectionCallback | null = null;
let lastObserverOptions: IntersectionObserverInit | undefined;

const mockObserve = jest.fn();
const mockUnobserve = jest.fn();
const mockDisconnect = jest.fn();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  constructor(callback: IntersectionCallback, options?: IntersectionObserverInit) {
    lastObserverCallback = callback;
    lastObserverOptions = options;
  }

  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

// ─── matchMedia mock ───────────────────────────────────────────────

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// ─── Setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  lastObserverCallback = null;
  lastObserverOptions = undefined;
  mockMatchMedia(false);
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  });
});

// ─── Tests ─────────────────────────────────────────────────────────

describe('ScrollReveal', () => {
  it('renders children', () => {
    render(
      <ScrollReveal>
        <p>Hello World</p>
      </ScrollReveal>
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('starts hidden (opacity 0, translateY 20px)', () => {
    render(
      <ScrollReveal>
        <p>Content</p>
      </ScrollReveal>
    );
    const wrapper = screen.getByText('Content').parentElement!;
    expect(wrapper.style.opacity).toBe('0');
    expect(wrapper.style.transform).toBe('translateY(20px)');
  });

  it('registers IntersectionObserver on mount', () => {
    render(
      <ScrollReveal>
        <p>Observed</p>
      </ScrollReveal>
    );
    expect(mockObserve).toHaveBeenCalledTimes(1);
    expect(lastObserverCallback).not.toBeNull();
  });

  it('uses default threshold of 0.15', () => {
    render(
      <ScrollReveal>
        <p>Threshold</p>
      </ScrollReveal>
    );
    expect(lastObserverOptions?.threshold).toBe(0.15);
  });

  it('supports stagger delay via transitionDelay', () => {
    render(
      <ScrollReveal delay={200}>
        <p>Delayed</p>
      </ScrollReveal>
    );
    const wrapper = screen.getByText('Delayed').parentElement!;
    expect(wrapper.style.transitionDelay).toBe('200ms');
  });

  it('defaults transitionDelay to 0ms', () => {
    render(
      <ScrollReveal>
        <p>No Delay</p>
      </ScrollReveal>
    );
    const wrapper = screen.getByText('No Delay').parentElement!;
    expect(wrapper.style.transitionDelay).toBe('0ms');
  });

  it('applies custom className', () => {
    render(
      <ScrollReveal className="custom-class">
        <p>Styled</p>
      </ScrollReveal>
    );
    const wrapper = screen.getByText('Styled').parentElement!;
    expect(wrapper.className).toBe('custom-class');
  });

  it('respects prefers-reduced-motion by showing immediately', () => {
    mockMatchMedia(true);
    render(
      <ScrollReveal>
        <p>Reduced</p>
      </ScrollReveal>
    );
    const wrapper = screen.getByText('Reduced').parentElement!;
    // When reduced motion is preferred, element should be visible immediately
    expect(wrapper.style.opacity).toBe('1');
    expect(wrapper.style.transform).toBe('translateY(0)');
  });
});
