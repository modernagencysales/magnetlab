/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  ThumbsUp: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="thumbs-up" {...props} />,
  ThumbsDown: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="thumbs-down" {...props} />,
  Send: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="send" {...props} />,
  X: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="x" {...props} />,
}));

import { FeedbackWidget } from '@/components/copilot/FeedbackWidget';

describe('FeedbackWidget', () => {
  const mockOnFeedback = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders thumbs up and down buttons', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    expect(screen.getByLabelText('Good response')).toBeInTheDocument();
    expect(screen.getByLabelText('Bad response')).toBeInTheDocument();
  });

  it('calls onFeedback with positive on thumbs up click', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Good response'));
    expect(mockOnFeedback).toHaveBeenCalledWith('positive', undefined);
  });

  it('shows note input on negative feedback click', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));
    expect(screen.getByPlaceholderText(/what could be better/i)).toBeInTheDocument();
  });

  it('submits negative feedback with note', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));

    const input = screen.getByPlaceholderText(/what could be better/i);
    fireEvent.change(input, { target: { value: 'Too formal' } });
    fireEvent.click(screen.getByLabelText('Submit feedback'));

    expect(mockOnFeedback).toHaveBeenCalledWith('negative', 'Too formal');
  });

  it('submits negative feedback without note on skip', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));
    fireEvent.click(screen.getByLabelText('Skip note'));

    expect(mockOnFeedback).toHaveBeenCalledWith('negative', undefined);
  });

  it('shows existing positive feedback state', () => {
    render(
      <FeedbackWidget
        onFeedback={mockOnFeedback}
        existingFeedback={{ rating: 'positive' }}
      />
    );
    const thumbsUp = screen.getByLabelText('Good response');
    expect(thumbsUp.className).toContain('emerald');
  });

  it('does not re-open note input after feedback submitted', () => {
    render(
      <FeedbackWidget
        onFeedback={mockOnFeedback}
        existingFeedback={{ rating: 'negative', note: 'Too formal' }}
      />
    );
    // Click negative — should not show input since feedback already exists
    fireEvent.click(screen.getByLabelText('Bad response'));
    expect(screen.queryByPlaceholderText(/what could be better/i)).not.toBeInTheDocument();
  });

  it('does not call onFeedback on positive click when feedback already exists', () => {
    render(
      <FeedbackWidget
        onFeedback={mockOnFeedback}
        existingFeedback={{ rating: 'positive' }}
      />
    );
    fireEvent.click(screen.getByLabelText('Good response'));
    expect(mockOnFeedback).not.toHaveBeenCalled();
  });

  it('submits note on Enter key', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));

    const input = screen.getByPlaceholderText(/what could be better/i);
    fireEvent.change(input, { target: { value: 'Wrong tone' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnFeedback).toHaveBeenCalledWith('negative', 'Wrong tone');
  });
});
