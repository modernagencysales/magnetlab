/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgressPanel from '@/components/accelerator/ProgressPanel';

// ─── Mocks ───────────────────────────────────────────────

jest.mock('@/lib/types/accelerator', () => ({
  MODULE_NAMES: {
    m0: 'Positioning & ICP',
    m1: 'Lead Magnets',
    m2: 'TAM Building',
    m3: 'LinkedIn Outreach',
    m4: 'Cold Email',
    m5: 'LinkedIn Ads',
    m6: 'Operating System',
    m7: 'Daily Content',
  },
}));

// ─── Fixtures ────────────────────────────────────────────

function makeProgramState(
  overrides: Partial<{
    enrollment: { id: string; intake_data: Record<string, unknown> } | null;
    modules: Array<{
      id: string;
      module_id: string;
      status: 'not_started' | 'active' | 'completed' | 'blocked' | 'skipped';
      current_step?: string;
    }>;
    deliverables: Array<{
      id: string;
      module_id: string;
      deliverable_type: string;
      status: 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected';
    }>;
    reviewQueue: Array<{
      id: string;
      module_id: string;
      deliverable_type: string;
      status: 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected';
    }>;
  }> = {}
) {
  return {
    enrollment: { id: 'enroll-1', intake_data: {} },
    modules: [
      { id: 'pm-0', module_id: 'm0', status: 'completed' as const },
      { id: 'pm-1', module_id: 'm1', status: 'active' as const },
      { id: 'pm-2', module_id: 'm2', status: 'not_started' as const },
    ],
    deliverables: [],
    reviewQueue: [],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('ProgressPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Empty State ─────────────────────────────────────

  it('shows "Loading your program..." when programState is null', () => {
    render(<ProgressPanel programState={null} />);
    expect(screen.getByText('Loading your program...')).toBeInTheDocument();
  });

  // ─── Modules Heading ────────────────────────────────

  it('shows "Modules" heading when state has modules', () => {
    render(<ProgressPanel programState={makeProgramState()} />);
    expect(screen.getByText('Modules')).toBeInTheDocument();
  });

  // ─── Module Names ───────────────────────────────────

  it('renders module names from MODULE_NAMES', () => {
    render(<ProgressPanel programState={makeProgramState()} />);
    expect(screen.getByText('Positioning & ICP')).toBeInTheDocument();
    expect(screen.getByText('Lead Magnets')).toBeInTheDocument();
    expect(screen.getByText('TAM Building')).toBeInTheDocument();
  });

  // ─── Module Status ──────────────────────────────────

  it('active module gets highlighted with ring-1 in className', () => {
    render(<ProgressPanel programState={makeProgramState()} />);

    // The active module is m1 ("Lead Magnets")
    const activeButton = screen.getByText('Lead Magnets').closest('button');
    expect(activeButton).toHaveClass('ring-1');
  });

  // ─── Module Click ───────────────────────────────────

  it('calls onModuleClick when a module row is clicked', () => {
    const onModuleClick = jest.fn();
    render(<ProgressPanel programState={makeProgramState()} onModuleClick={onModuleClick} />);

    const moduleButton = screen.getByText('TAM Building').closest('button')!;
    fireEvent.click(moduleButton);

    expect(onModuleClick).toHaveBeenCalledWith('m2');
  });

  // ─── Collapse Toggle ───────────────────────────────

  it('clicking collapse hides content', () => {
    render(<ProgressPanel programState={makeProgramState()} />);

    // Content is visible initially
    expect(screen.getByText('Modules')).toBeInTheDocument();

    // Click the collapse button
    const collapseButton = screen.getByLabelText('Collapse progress panel');
    fireEvent.click(collapseButton);

    // Content should be hidden
    expect(screen.queryByText('Modules')).not.toBeInTheDocument();
  });

  // ─── Review Queue ──────────────────────────────────

  it('shows "Needs Review" section with count when reviewQueue has items', () => {
    const state = makeProgramState({
      reviewQueue: [
        { id: 'rd-1', module_id: 'm0', deliverable_type: 'icp_document', status: 'pending_review' },
        {
          id: 'rd-2',
          module_id: 'm1',
          deliverable_type: 'lead_magnet_draft',
          status: 'pending_review',
        },
      ],
    });

    render(<ProgressPanel programState={state} />);
    expect(screen.getByText('Needs Review (2)')).toBeInTheDocument();
  });

  // ─── Deliverables Section ──────────────────────────

  it('shows deliverable types', () => {
    const state = makeProgramState({
      deliverables: [
        { id: 'd-1', module_id: 'm0', deliverable_type: 'icp_document', status: 'approved' },
        {
          id: 'd-2',
          module_id: 'm1',
          deliverable_type: 'lead_magnet_draft',
          status: 'in_progress',
        },
      ],
    });

    render(<ProgressPanel programState={state} />);

    // deliverable_type underscores are replaced with spaces
    expect(screen.getByText('icp document')).toBeInTheDocument();
    expect(screen.getByText('lead magnet draft')).toBeInTheDocument();
  });

  // ─── Empty Deliverables ────────────────────────────

  it('shows placeholder text when no deliverables', () => {
    const state = makeProgramState({ deliverables: [] });

    render(<ProgressPanel programState={state} />);
    expect(
      screen.getByText('Deliverables will appear here as you work through modules.')
    ).toBeInTheDocument();
  });

  // ─── Active Module Current Step ────────────────────

  it('shows current_step text for active modules', () => {
    const state = makeProgramState({
      modules: [
        { id: 'pm-0', module_id: 'm0', status: 'completed' },
        {
          id: 'pm-1',
          module_id: 'm1',
          status: 'active',
          current_step: 'Reviewing your lead magnet draft',
        },
        { id: 'pm-2', module_id: 'm2', status: 'not_started' },
      ],
    });

    render(<ProgressPanel programState={state} />);
    expect(screen.getByText('Reviewing your lead magnet draft')).toBeInTheDocument();
  });
});
