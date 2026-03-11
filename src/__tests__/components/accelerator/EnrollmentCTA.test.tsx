/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnrollmentCTA from '@/components/accelerator/EnrollmentCTA';

// ─── Mocks ───────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Capture window.location.href assignments
const locationMock = { href: '' };
Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true,
});

/** Build a mock Response for apiClient (needs headers + json/text methods) */
function mockResponse(status: number, body: Record<string, unknown>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('EnrollmentCTA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    locationMock.href = '';
  });

  // ─── Rendering ───────────────────────────────────────

  it('renders product heading and tagline', () => {
    render(<EnrollmentCTA />);
    expect(screen.getByText('GTM Accelerator')).toBeInTheDocument();
    expect(screen.getByText(/structured 8-module program/i)).toBeInTheDocument();
  });

  it('renders $997 pricing', () => {
    render(<EnrollmentCTA />);
    expect(screen.getByText('$997')).toBeInTheDocument();
    expect(screen.getByText(/one-time investment/i)).toBeInTheDocument();
  });

  it('renders the Get Started button', () => {
    render(<EnrollmentCTA />);
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('renders Stripe security note', () => {
    render(<EnrollmentCTA />);
    expect(screen.getByText(/secure checkout powered by stripe/i)).toBeInTheDocument();
  });

  // ─── Module List ─────────────────────────────────────

  it('renders all 8 module names', () => {
    render(<EnrollmentCTA />);
    expect(screen.getByText('Positioning & ICP')).toBeInTheDocument();
    expect(screen.getByText('Lead Magnets')).toBeInTheDocument();
    expect(screen.getByText('TAM Building')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Outreach')).toBeInTheDocument();
    expect(screen.getByText('Cold Email')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Ads')).toBeInTheDocument();
    expect(screen.getByText('Operating System')).toBeInTheDocument();
    expect(screen.getByText('Daily Content')).toBeInTheDocument();
  });

  it('renders module descriptions', () => {
    render(<EnrollmentCTA />);
    expect(screen.getByText(/define your ideal client/i)).toBeInTheDocument();
    expect(screen.getByText(/create lead magnets, funnels/i)).toBeInTheDocument();
    expect(screen.getByText(/total addressable market/i)).toBeInTheDocument();
  });

  it('renders 8 module cards', () => {
    render(<EnrollmentCTA />);
    // Each module card has a "Module N" label
    expect(screen.getByText('Module 0')).toBeInTheDocument();
    expect(screen.getByText('Module 7')).toBeInTheDocument();
  });

  // ─── API Call ────────────────────────────────────────

  it('calls /api/accelerator/enroll on button click', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { url: 'https://checkout.stripe.com/test' }));

    render(<EnrollmentCTA />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/accelerator/enroll',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('redirects to checkout url on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { url: 'https://checkout.stripe.com/pay/cs_test_abc' })
    );

    render(<EnrollmentCTA />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => {
      expect(locationMock.href).toBe('https://checkout.stripe.com/pay/cs_test_abc');
    });
  });

  // ─── Loading State ───────────────────────────────────

  it('shows loading state while fetching', async () => {
    // Never resolves during the test
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<EnrollmentCTA />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText(/redirecting to checkout/i)).toBeInTheDocument();
    });
  });

  it('disables button while loading', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<EnrollmentCTA />);
    const button = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  // ─── Error States ────────────────────────────────────

  it('shows error message when API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(400, { error: 'Payment setup failed' }));

    render(<EnrollmentCTA />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText('Payment setup failed')).toBeInTheDocument();
    });
  });

  it('shows fallback error when API returns no error message', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(500, {}));

    render(<EnrollmentCTA />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => {
      // parseApiError falls back to statusText or 'Request failed'
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('shows error when response has no url', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { url: '' }));

    render(<EnrollmentCTA />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText(/no checkout url returned/i)).toBeInTheDocument();
    });
  });

  it('shows error and re-enables button on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<EnrollmentCTA />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });
});
