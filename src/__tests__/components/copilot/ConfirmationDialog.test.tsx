/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-alert-triangle" {...props} />,
}));

import { ConfirmationDialog } from '@/components/copilot/ConfirmationDialog';

describe('ConfirmationDialog', () => {
  const mockOnConfirm = jest.fn();

  const defaultProps = {
    toolName: 'schedule_post',
    toolArgs: { postId: 'post-123', scheduledAt: '2026-03-01T10:00:00Z' },
    toolUseId: 'tool-use-1',
    onConfirm: mockOnConfirm,
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders confirmation dialog with tool name heading', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('Confirmation Required')).toBeInTheDocument();
    expect(screen.getByTestId('icon-alert-triangle')).toBeInTheDocument();
  });

  it('shows human-readable description for schedule_post', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('Schedule this post for publishing')).toBeInTheDocument();
  });

  it('shows human-readable description for publish_funnel', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        toolName="publish_funnel"
      />
    );
    expect(screen.getByText('Publish this funnel page (makes it publicly accessible)')).toBeInTheDocument();
  });

  it('shows human-readable description for create_lead_magnet', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        toolName="create_lead_magnet"
      />
    );
    expect(screen.getByText('Create a new lead magnet')).toBeInTheDocument();
  });

  it('shows default description for unknown tool', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        toolName="some_unknown_tool"
      />
    );
    expect(screen.getByText('Execute some_unknown_tool')).toBeInTheDocument();
  });

  it('displays formatted tool args', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    const pre = screen.getByText(/"postId":/);
    expect(pre).toBeInTheDocument();
    expect(pre.textContent).toContain('"post-123"');
  });

  it('calls onConfirm with (toolUseId, true) when Confirm clicked', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockOnConfirm).toHaveBeenCalledWith('tool-use-1', true);
  });

  it('calls onConfirm with (toolUseId, false) when Cancel clicked', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnConfirm).toHaveBeenCalledWith('tool-use-1', false);
  });
});
