import React from 'react';
import { render, screen } from '@testing-library/react';
import { LinkedInPreview } from '@/components/content-pipeline/LinkedInPreview';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ThumbsUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-up" {...props} />,
  MessageCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-message-circle" {...props} />,
  Repeat2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-repeat2" {...props} />,
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-send" {...props} />,
  Globe: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-globe" {...props} />,
}));

const SHORT_CONTENT = 'This is a short post about LinkedIn marketing.';

const LONG_CONTENT = Array(25)
  .fill(null)
  .map((_, i) => `Line ${i + 1}: This is a longer line of content that simulates a real LinkedIn post with enough text to fill multiple visual lines.`)
  .join('\n');

const defaultProps = {
  content: SHORT_CONTENT,
  authorName: 'Jane Doe',
  authorHeadline: 'CEO at Acme Corp',
  authorAvatarUrl: null,
};

describe('LinkedInPreview', () => {
  it('renders the author name', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders the author headline', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText('CEO at Acme Corp')).toBeInTheDocument();
  });

  it('renders the post content', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText(SHORT_CONTENT)).toBeInTheDocument();
  });

  it('shows "...more" for long content (20+ lines)', () => {
    render(<LinkedInPreview {...defaultProps} content={LONG_CONTENT} />);
    expect(screen.getByText('...more')).toBeInTheDocument();
  });

  it('does NOT show "...more" for short content', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.queryByText('...more')).not.toBeInTheDocument();
  });

  it('renders initials when no avatar URL is provided', () => {
    render(<LinkedInPreview {...defaultProps} authorAvatarUrl={null} />);
    // Initials for "Jane Doe" should be "JD"
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders avatar image when URL is provided', () => {
    render(
      <LinkedInPreview
        {...defaultProps}
        authorAvatarUrl="https://example.com/avatar.jpg"
      />
    );
    const img = screen.getByAltText('Jane Doe');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('applies desktop device mode by default', () => {
    const { container } = render(<LinkedInPreview {...defaultProps} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute('data-device', 'desktop');
  });

  it('applies mobile device mode when specified', () => {
    const { container } = render(
      <LinkedInPreview {...defaultProps} device="mobile" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute('data-device', 'mobile');
  });

  it('renders engagement bar buttons (Like, Comment, Repost, Send)', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText('Like')).toBeInTheDocument();
    expect(screen.getByText('Comment')).toBeInTheDocument();
    expect(screen.getByText('Repost')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('renders "Just now" timestamp', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText(/Just now/)).toBeInTheDocument();
  });
});
