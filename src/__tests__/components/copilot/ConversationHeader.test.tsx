/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConversationHeader } from '@/components/copilot/ConversationHeader';

// Mock lucide-react icons to render as simple elements with test IDs
jest.mock('lucide-react', () => ({
  ArrowLeft: (props: Record<string, unknown>) => <svg data-testid="icon-arrow-left" {...props} />,
  Plus: (props: Record<string, unknown>) => <svg data-testid="icon-plus" {...props} />,
  FileText: (props: Record<string, unknown>) => <svg data-testid="icon-file-text" {...props} />,
  Megaphone: (props: Record<string, unknown>) => <svg data-testid="icon-megaphone" {...props} />,
  BookOpen: (props: Record<string, unknown>) => <svg data-testid="icon-book-open" {...props} />,
  Lightbulb: (props: Record<string, unknown>) => <svg data-testid="icon-lightbulb" {...props} />,
}));

describe('ConversationHeader', () => {
  const defaultProps = {
    onBack: jest.fn(),
    onNewThread: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows conversation title', () => {
    render(<ConversationHeader {...defaultProps} title="My test conversation" />);

    expect(screen.getByText('My test conversation')).toBeInTheDocument();
  });

  it('shows "New conversation" when title is empty', () => {
    render(<ConversationHeader {...defaultProps} />);

    expect(screen.getByText('New conversation')).toBeInTheDocument();
  });

  it('shows "New conversation" when title is undefined', () => {
    render(<ConversationHeader {...defaultProps} title={undefined} />);

    expect(screen.getByText('New conversation')).toBeInTheDocument();
  });

  it('shows entity badge with icon when entityType and entityTitle provided', () => {
    render(
      <ConversationHeader
        {...defaultProps}
        title="Draft post"
        entityType="post"
        entityTitle="LinkedIn post about AI"
      />
    );

    expect(screen.getByText('LinkedIn post about AI')).toBeInTheDocument();
    expect(screen.getByTestId('icon-file-text')).toBeInTheDocument();
  });

  it('shows correct icon for funnel entity type', () => {
    render(
      <ConversationHeader
        {...defaultProps}
        entityType="funnel"
        entityTitle="My funnel"
      />
    );

    expect(screen.getByTestId('icon-megaphone')).toBeInTheDocument();
    expect(screen.getByText('My funnel')).toBeInTheDocument();
  });

  it('shows correct icon for lead_magnet entity type', () => {
    render(
      <ConversationHeader
        {...defaultProps}
        entityType="lead_magnet"
        entityTitle="Lead Magnet Guide"
      />
    );

    expect(screen.getByTestId('icon-book-open')).toBeInTheDocument();
    expect(screen.getByText('Lead Magnet Guide')).toBeInTheDocument();
  });

  it('shows correct icon for idea entity type', () => {
    render(
      <ConversationHeader
        {...defaultProps}
        entityType="idea"
        entityTitle="Content idea"
      />
    );

    expect(screen.getByTestId('icon-lightbulb')).toBeInTheDocument();
    expect(screen.getByText('Content idea')).toBeInTheDocument();
  });

  it('hides entity badge when no entityType', () => {
    render(
      <ConversationHeader
        {...defaultProps}
        title="Some conversation"
        entityTitle="Should not appear"
      />
    );

    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
  });

  it('hides entity badge when no entityTitle', () => {
    render(
      <ConversationHeader
        {...defaultProps}
        title="Some conversation"
        entityType="post"
      />
    );

    // The icon should not appear since entityTitle is missing
    expect(screen.queryByTestId('icon-file-text')).not.toBeInTheDocument();
  });

  it('hides entity badge for unknown entity type', () => {
    render(
      <ConversationHeader
        {...defaultProps}
        entityType="unknown_type"
        entityTitle="Unknown"
      />
    );

    // No icon rendered for unknown type, so badge is hidden
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('Back button calls onBack', () => {
    const onBack = jest.fn();
    render(<ConversationHeader {...defaultProps} onBack={onBack} title="Test" />);

    const backButton = screen.getByLabelText('Back');
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('New Thread button calls onNewThread', () => {
    const onNewThread = jest.fn();
    render(<ConversationHeader {...defaultProps} onNewThread={onNewThread} title="Test" />);

    const newThreadButton = screen.getByLabelText('New thread');
    fireEvent.click(newThreadButton);

    expect(onNewThread).toHaveBeenCalledTimes(1);
  });
});
