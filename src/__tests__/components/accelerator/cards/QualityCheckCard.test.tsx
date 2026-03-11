/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QualityCheckCard } from '@/components/accelerator/cards/QualityCheckCard';

// ─── Fixtures ────────────────────────────────────────────

const passedData = {
  passed: true,
  checks: [
    { check: 'Hook clarity', passed: true, severity: 'critical', feedback: 'Strong opening hook' },
    { check: 'CTA present', passed: true, severity: 'minor' },
  ],
  feedback: 'All checks passed. Content is ready for publishing.',
};

const failedData = {
  passed: false,
  checks: [
    {
      check: 'Word count',
      passed: false,
      severity: 'critical',
      feedback: 'Post exceeds 3000 characters',
    },
    { check: 'Formatting', passed: true, severity: 'minor' },
  ],
  feedback: 'Fix the critical issues before proceeding.',
};

// ─── Tests ───────────────────────────────────────────────

describe('QualityCheckCard', () => {
  // ─── Missing Data ────────────────────────────────────

  it('returns null when data is undefined', () => {
    const { container } = render(<QualityCheckCard data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  // ─── Pass State ──────────────────────────────────────

  it('renders "Quality Check Passed" when passed is true', () => {
    render(<QualityCheckCard data={passedData} />);
    expect(screen.getByText('Quality Check Passed')).toBeInTheDocument();
  });

  it('uses green border when passed', () => {
    const { container } = render(<QualityCheckCard data={passedData} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-green-200');
  });

  // ─── Fail State ──────────────────────────────────────

  it('renders "Quality Check Failed" when passed is false', () => {
    render(<QualityCheckCard data={failedData} />);
    expect(screen.getByText('Quality Check Failed')).toBeInTheDocument();
  });

  it('renders "Quality Check Failed" when passed is undefined', () => {
    render(<QualityCheckCard data={{ checks: [] }} />);
    expect(screen.getByText('Quality Check Failed')).toBeInTheDocument();
  });

  it('uses red border when failed', () => {
    const { container } = render(<QualityCheckCard data={failedData} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-red-200');
  });

  // ─── Check Items ─────────────────────────────────────

  it('renders check items with check name', () => {
    render(<QualityCheckCard data={passedData} />);
    expect(screen.getByText('Hook clarity')).toBeInTheDocument();
    expect(screen.getByText('CTA present')).toBeInTheDocument();
  });

  it('shows feedback text for individual checks', () => {
    render(<QualityCheckCard data={passedData} />);
    expect(screen.getByText('Strong opening hook')).toBeInTheDocument();
  });

  it('shows overall feedback text', () => {
    render(<QualityCheckCard data={passedData} />);
    expect(
      screen.getByText('All checks passed. Content is ready for publishing.')
    ).toBeInTheDocument();
  });

  it('critical checks render with font-medium', () => {
    render(<QualityCheckCard data={failedData} />);
    const wordCountEl = screen.getByText('Word count');
    expect(wordCountEl.className).toContain('font-medium');
  });
});
