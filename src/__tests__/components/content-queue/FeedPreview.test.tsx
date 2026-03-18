/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

/* eslint-disable @next/next/no-img-element */
// Mock LinkedInPreview — the underlying component uses next/image
jest.mock('@/components/content-pipeline/LinkedInPreview', () => ({
  LinkedInPreview: ({
    authorName,
    content,
    hookOnly,
    imageUrl,
  }: {
    authorName: string;
    content: string;
    authorHeadline: string;
    authorAvatarUrl: string | null;
    hookOnly?: boolean;
    imageUrl?: string | null;
  }) => (
    <div data-testid="linkedin-preview" data-hook-only={hookOnly}>
      <span>{authorName}</span>
      <span>{content.split('\n').slice(0, 3).join('\n')}</span>
      {hookOnly && content.split('\n').length > 3 && <span>...see more</span>}
      {imageUrl && <img src={imageUrl} alt="Post" />}
    </div>
  ),
}));

import { FeedPreview } from '@/components/content-queue/FeedPreview';

describe('FeedPreview', () => {
  const defaultProps = {
    content:
      'Line one of the hook.\n\nLine two of the hook.\n\nLine three continues.\n\nThis line should be hidden in feed preview.',
    authorName: 'Sarah Kim',
    authorHeadline: 'CEO @ Meridian Digital',
    imageUrl: null,
    onClick: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders author name', () => {
    render(<FeedPreview {...defaultProps} />);
    expect(screen.getByText('Sarah Kim')).toBeInTheDocument();
  });

  it('shows truncation indicator', () => {
    render(<FeedPreview {...defaultProps} />);
    expect(screen.getByText(/see more/i)).toBeInTheDocument();
  });

  it('renders image when provided', () => {
    render(<FeedPreview {...defaultProps} imageUrl="https://example.com/img.png" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
  });

  it('does not render image when not provided', () => {
    render(<FeedPreview {...defaultProps} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<FeedPreview {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes hookOnly to LinkedInPreview', () => {
    render(<FeedPreview {...defaultProps} />);
    const preview = screen.getByTestId('linkedin-preview');
    expect(preview).toHaveAttribute('data-hook-only', 'true');
  });
});
