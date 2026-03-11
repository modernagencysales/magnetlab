/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────

const mockGetProgramState = jest.fn();

jest.mock('@/frontend/api/accelerator', () => ({
  getProgramState: (...args: unknown[]) => mockGetProgramState(...args),
}));

jest.mock('@/components/accelerator/AcceleratorChat', () => {
  return function MockAcceleratorChat(props: Record<string, unknown>) {
    return (
      <div data-testid="accelerator-chat" data-needs-onboarding={String(props.needsOnboarding)} />
    );
  };
});

jest.mock('@/components/accelerator/EnrollmentCTA', () => {
  return function MockEnrollmentCTA() {
    return <div data-testid="enrollment-cta" />;
  };
});

jest.mock('@/components/accelerator/ProgressPanel', () => {
  return function MockProgressPanel() {
    return <div data-testid="progress-panel" />;
  };
});

import AcceleratorPage from '@/components/accelerator/AcceleratorPage';
import type { ProgramState } from '@/lib/types/accelerator';

// ─── Helpers ─────────────────────────────────────────────

function buildProgramState(overrides?: Partial<ProgramState>): ProgramState {
  return {
    enrollment: {
      id: 'enroll-1',
      user_id: 'user-1',
      enrolled_at: '2026-01-01T00:00:00Z',
      selected_modules: ['m0', 'm1'],
      coaching_mode: 'guide_me',
      onboarding_completed_at: null,
      intake_data: null,
      stripe_subscription_id: null,
      stripe_customer_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    modules: [],
    deliverables: [],
    reviewQueue: [],
    usageThisPeriod: { sessions: 0, deliverables: 0, api_calls: 0 },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('AcceleratorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading State ────────────────────────────────────

  it('shows loading spinner initially', () => {
    mockGetProgramState.mockImplementation(() => new Promise(() => {}));

    render(<AcceleratorPage userId="user-1" />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows loading text "Loading your program..."', () => {
    mockGetProgramState.mockImplementation(() => new Promise(() => {}));

    render(<AcceleratorPage userId="user-1" />);

    expect(screen.getByText('Loading your program...')).toBeInTheDocument();
  });

  // ─── Not Enrolled ─────────────────────────────────────

  it('shows EnrollmentCTA when not enrolled', async () => {
    mockGetProgramState.mockResolvedValueOnce({
      enrolled: false,
      programState: null,
    });

    render(<AcceleratorPage userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('enrollment-cta')).toBeInTheDocument();
    });
  });

  // ─── Enrolled ─────────────────────────────────────────

  it('shows AcceleratorChat and ProgressPanel when enrolled', async () => {
    mockGetProgramState.mockResolvedValueOnce({
      enrolled: true,
      programState: buildProgramState({
        enrollment: {
          id: 'enroll-1',
          user_id: 'user-1',
          enrolled_at: '2026-01-01T00:00:00Z',
          selected_modules: ['m0'],
          coaching_mode: 'guide_me',
          onboarding_completed_at: '2026-01-02T00:00:00Z',
          intake_data: {
            business_description: 'We sell widgets',
            target_audience: 'SMBs',
            revenue_range: 'under_5k',
            linkedin_frequency: 'weekly',
            channels_of_interest: ['linkedin'],
            primary_goal: 'Get leads',
          },
          stripe_subscription_id: null,
          stripe_customer_id: null,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      }),
    });

    render(<AcceleratorPage userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('accelerator-chat')).toBeInTheDocument();
      expect(screen.getByTestId('progress-panel')).toBeInTheDocument();
    });
  });

  // ─── Error State ──────────────────────────────────────

  it('shows error message when API call fails', async () => {
    mockGetProgramState.mockRejectedValueOnce(new Error('Network error'));

    render(<AcceleratorPage userId="user-1" />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load your program: Network error. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('shows Try Again button on error', async () => {
    mockGetProgramState.mockRejectedValueOnce(new Error('Network error'));

    render(<AcceleratorPage userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  // ─── Onboarding Detection ─────────────────────────────

  it('passes needsOnboarding=true when intake_data has no business_description', async () => {
    mockGetProgramState.mockResolvedValueOnce({
      enrolled: true,
      programState: buildProgramState({
        enrollment: {
          id: 'enroll-1',
          user_id: 'user-1',
          enrolled_at: '2026-01-01T00:00:00Z',
          selected_modules: ['m0'],
          coaching_mode: 'guide_me',
          onboarding_completed_at: null,
          intake_data: null,
          stripe_subscription_id: null,
          stripe_customer_id: null,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      }),
    });

    render(<AcceleratorPage userId="user-1" />);

    await waitFor(() => {
      const chat = screen.getByTestId('accelerator-chat');
      expect(chat).toHaveAttribute('data-needs-onboarding', 'true');
    });
  });

  it('passes needsOnboarding=false when intake_data has business_description', async () => {
    mockGetProgramState.mockResolvedValueOnce({
      enrolled: true,
      programState: buildProgramState({
        enrollment: {
          id: 'enroll-1',
          user_id: 'user-1',
          enrolled_at: '2026-01-01T00:00:00Z',
          selected_modules: ['m0'],
          coaching_mode: 'guide_me',
          onboarding_completed_at: '2026-01-02T00:00:00Z',
          intake_data: {
            business_description: 'We help agencies grow',
            target_audience: 'Agency owners',
            revenue_range: '5k_10k',
            linkedin_frequency: 'daily',
            channels_of_interest: ['linkedin', 'email'],
            primary_goal: 'Scale revenue',
          },
          stripe_subscription_id: null,
          stripe_customer_id: null,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      }),
    });

    render(<AcceleratorPage userId="user-1" />);

    await waitFor(() => {
      const chat = screen.getByTestId('accelerator-chat');
      expect(chat).toHaveAttribute('data-needs-onboarding', 'false');
    });
  });
});
