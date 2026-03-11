/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalCard } from '@/components/accelerator/cards/ApprovalCard';

// ─── Fixtures ────────────────────────────────────────────

const fullData = {
  action: 'deploy_funnel',
  description: 'This will publish the funnel to production.',
  items: ['Update DNS records', 'Enable SSL certificate', 'Notify team members'],
};

// ─── Tests ───────────────────────────────────────────────

describe('ApprovalCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Missing Data ────────────────────────────────────

  it('returns null when data is undefined', () => {
    const { container } = render(<ApprovalCard data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  // ─── Rendering ───────────────────────────────────────

  it('renders "Confirmation Required" heading', () => {
    render(<ApprovalCard data={fullData} />);
    expect(screen.getByText('Confirmation Required')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<ApprovalCard data={fullData} />);
    expect(screen.getByText('This will publish the funnel to production.')).toBeInTheDocument();
  });

  it('renders items list', () => {
    render(<ApprovalCard data={fullData} />);
    expect(screen.getByText('Update DNS records')).toBeInTheDocument();
    expect(screen.getByText('Enable SSL certificate')).toBeInTheDocument();
    expect(screen.getByText('Notify team members')).toBeInTheDocument();
  });

  it('renders 3 buttons: Approve, Edit First, Cancel', () => {
    const onApply = jest.fn();
    render(<ApprovalCard data={fullData} onApply={onApply} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ─── Interactions ────────────────────────────────────

  it('calls onApply("confirm_action", data) on Approve click', () => {
    const onApply = jest.fn();
    render(<ApprovalCard data={fullData} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApply).toHaveBeenCalledWith('confirm_action', fullData);
  });

  it('calls onApply("edit_first", data) on Edit First click', () => {
    const onApply = jest.fn();
    render(<ApprovalCard data={fullData} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit First' }));
    expect(onApply).toHaveBeenCalledWith('edit_first', fullData);
  });

  it('calls onApply("cancel_action", data) on Cancel click', () => {
    const onApply = jest.fn();
    render(<ApprovalCard data={fullData} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onApply).toHaveBeenCalledWith('cancel_action', fullData);
  });

  // ─── Conditional Rendering ─────────────────────────

  it('does not render buttons when onApply is missing', () => {
    render(<ApprovalCard data={fullData} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit First' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
