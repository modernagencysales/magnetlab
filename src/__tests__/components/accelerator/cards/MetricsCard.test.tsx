/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MetricsCard } from '@/components/accelerator/cards/MetricsCard';

// ─── Fixtures ────────────────────────────────────────────

const fullData = {
  title: 'Campaign Performance',
  metrics: [
    { label: 'Open Rate', value: '42%', change: '+5%', trend: 'up' as const },
    { label: 'Reply Rate', value: '12%', change: '-2%', trend: 'down' as const },
    { label: 'Bounce Rate', value: '3%' },
    { label: 'Meetings Booked', value: 8, change: '0%', trend: 'neutral' as const },
  ],
};

// ─── Tests ───────────────────────────────────────────────

describe('MetricsCard', () => {
  // ─── Missing Data ────────────────────────────────────

  it('returns null when data is undefined', () => {
    const { container } = render(<MetricsCard data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when metrics array is empty', () => {
    const { container } = render(<MetricsCard data={{ metrics: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  // ─── Title ───────────────────────────────────────────

  it('renders custom title when provided', () => {
    render(<MetricsCard data={fullData} />);
    expect(screen.getByText('Campaign Performance')).toBeInTheDocument();
  });

  it('renders "Metrics" as default title', () => {
    render(<MetricsCard data={{ metrics: [{ label: 'Test', value: 1 }] }} />);
    expect(screen.getByText('Metrics')).toBeInTheDocument();
  });

  // ─── Metric Content ─────────────────────────────────

  it('renders metric labels', () => {
    render(<MetricsCard data={fullData} />);
    expect(screen.getByText('Open Rate')).toBeInTheDocument();
    expect(screen.getByText('Reply Rate')).toBeInTheDocument();
    expect(screen.getByText('Bounce Rate')).toBeInTheDocument();
    expect(screen.getByText('Meetings Booked')).toBeInTheDocument();
  });

  it('renders metric values', () => {
    render(<MetricsCard data={fullData} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('3%')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders change text for metrics with change', () => {
    render(<MetricsCard data={fullData} />);
    expect(screen.getByText('+5%')).toBeInTheDocument();
    expect(screen.getByText('-2%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('does not render trend indicator when trend is not provided', () => {
    render(<MetricsCard data={{ metrics: [{ label: 'Bounce Rate', value: '3%' }] }} />);
    // The TrendIndicator returns null when both trend and change are missing,
    // so no SVG arrow should be present in the metric cell
    const metricCell = screen.getByText('Bounce Rate').closest('div')!.parentElement!;
    const svgs = metricCell.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });
});
