/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckoutCard from '@/components/accelerator/cards/CheckoutCard';

// ─── Mocks ───────────────────────────────────────────────

const openMock = jest.fn();
Object.defineProperty(window, 'open', { value: openMock, writable: true });

// ─── Fixtures ────────────────────────────────────────────

const fullData = {
  title: 'Starter Infrastructure',
  tier: 'Starter',
  features: ['5 email domains', '25 mailboxes', 'Google Workspace'],
  price: '$297 + $200/mo',
  checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_abc123',
};

// ─── Tests ───────────────────────────────────────────────

describe('CheckoutCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Rendering ───────────────────────────────────────

  it('renders title', () => {
    render(<CheckoutCard data={fullData} />);
    expect(screen.getByText('Starter Infrastructure')).toBeInTheDocument();
  });

  it('renders tier badge', () => {
    render(<CheckoutCard data={fullData} />);
    expect(screen.getByText('Starter')).toBeInTheDocument();
  });

  it('renders all features as bullet points', () => {
    render(<CheckoutCard data={fullData} />);
    expect(screen.getByText('5 email domains')).toBeInTheDocument();
    expect(screen.getByText('25 mailboxes')).toBeInTheDocument();
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
  });

  it('renders price', () => {
    render(<CheckoutCard data={fullData} />);
    expect(screen.getByText('$297 + $200/mo')).toBeInTheDocument();
  });

  it('renders Proceed to Checkout button when checkoutUrl is present', () => {
    render(<CheckoutCard data={fullData} />);
    expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeInTheDocument();
  });

  // ─── Interactions ────────────────────────────────────

  it('calls onApply with type "checkout" and data on button click', () => {
    const onApply = jest.fn();
    render(<CheckoutCard data={fullData} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /proceed to checkout/i }));
    expect(onApply).toHaveBeenCalledWith('checkout', fullData);
  });

  it('opens checkoutUrl in a new tab on button click', () => {
    render(<CheckoutCard data={fullData} />);
    fireEvent.click(screen.getByRole('button', { name: /proceed to checkout/i }));
    expect(openMock).toHaveBeenCalledWith(fullData.checkoutUrl, '_blank', 'noopener,noreferrer');
  });

  // ─── Missing Data ────────────────────────────────────

  it('returns null when data is undefined', () => {
    const { container } = render(<CheckoutCard data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows fallback title when title is missing', () => {
    render(<CheckoutCard data={{ checkoutUrl: 'https://example.com' }} />);
    expect(screen.getByText('Tool Provisioning')).toBeInTheDocument();
  });

  it('shows no-url message when checkoutUrl is missing', () => {
    render(<CheckoutCard data={{ title: 'Test', price: '$100' }} />);
    expect(screen.getByText(/no checkout url available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /proceed to checkout/i })).not.toBeInTheDocument();
  });

  it('does not render tier badge when tier is missing', () => {
    render(<CheckoutCard data={{ title: 'Test' }} />);
    // Only one element — the title — no tier badge
    expect(screen.queryByText('Starter')).not.toBeInTheDocument();
  });

  it('does not render features list when features array is empty', () => {
    const { container } = render(<CheckoutCard data={{ title: 'Test', features: [] }} />);
    expect(container.querySelector('ul')).not.toBeInTheDocument();
  });

  it('does not call window.open when checkoutUrl is missing', () => {
    render(<CheckoutCard data={{ title: 'Test' }} />);
    // No button rendered, so no open call possible
    expect(openMock).not.toHaveBeenCalled();
  });
});
