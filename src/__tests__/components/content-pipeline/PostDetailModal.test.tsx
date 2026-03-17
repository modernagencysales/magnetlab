/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import type { PipelinePost } from '@/lib/types/content-pipeline';

// Mock PostPreview (uses LinkedInPreview) - component displays content via PostPreview
jest.mock('@/components/content-pipeline/PostPreview', () => ({
  PostPreview: ({ content }: { content: string }) => (
    <div data-testid="linkedin-preview">{content}</div>
  ),
}));

// Mock StatusBadge
jest.mock('@/components/content-pipeline/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock StyleFeedbackToast
jest.mock('@/components/content-pipeline/StyleFeedbackToast', () => ({
  StyleFeedbackToast: () => <div data-testid="style-feedback-toast" />,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-copy" {...props} />,
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-sparkles" {...props} />
  ),
  Calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-calendar" {...props} />
  ),
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-send" {...props} />,
  Linkedin: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-linkedin" {...props} />
  ),
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />,
  Zap: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-zap" {...props} />,
  MessageSquare: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-message-square" {...props} />
  ),
  FileText: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-file-text" {...props} />
  ),
}));

// Mock fetch globally for profile data
global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('/api/teams/profiles')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        profiles: [
          {
            id: 'p1',
            full_name: 'Tim Smith',
            title: 'CEO',
            avatar_url: null,
            is_default: true,
          },
        ],
      }),
    });
  }
  if (url.includes('/engagement')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ stats: null, config: { scrape_engagement: false } }),
    });
  }
  if (url.includes('/automations')) {
    return Promise.resolve({ ok: true, json: async () => ({ automations: [] }) });
  }
  return Promise.resolve({ ok: true, json: async () => ({}) });
});

import { PostDetailModal } from '@/components/content-pipeline/PostDetailModal';

const mockPost: PipelinePost = {
  id: 'test-1',
  user_id: 'user-1',
  idea_id: null,
  draft_content: 'Test post content for the editor.',
  final_content: null,
  dm_template: null,
  cta_word: null,
  variations: null,
  status: 'draft' as const,
  scheduled_time: null,
  linkedin_post_id: null,
  publish_provider: null,
  lead_magnet_id: null,
  hook_score: 7,
  polish_status: null,
  polish_notes: null,
  is_buffer: false,
  buffer_position: null,
  auto_publish_after: null,
  published_at: null,
  template_id: null,
  style_id: null,
  enable_automation: false,
  automation_config: null,
  review_data: null,
  engagement_stats: null,
  scrape_engagement: false,
  heyreach_campaign_id: null,
  last_engagement_scrape_at: null,
  engagement_scrape_count: 0,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const defaultProps = {
  post: mockPost,
  onClose: jest.fn(),
  onPolish: jest.fn(),
  onUpdate: jest.fn(),
  polishing: false,
};

describe('PostDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock fetch since jest.clearAllMocks resets it
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/teams/profiles')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            profiles: [
              {
                id: 'p1',
                full_name: 'Tim Smith',
                title: 'CEO',
                avatar_url: null,
                is_default: true,
              },
            ],
          }),
        });
      }
      if (url.includes('/engagement')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ stats: null, config: { scrape_engagement: false } }),
        });
      }
      if (url.includes('/automations')) {
        return Promise.resolve({ ok: true, json: async () => ({ automations: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders the post content in preview', async () => {
    render(<PostDetailModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('linkedin-preview')).toBeInTheDocument();
    });
    expect(screen.getByTestId('linkedin-preview')).toHaveTextContent(
      'Test post content for the editor.'
    );
  });

  it('renders Hook Score', async () => {
    render(<PostDetailModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Hook Score:')).toBeInTheDocument();
    });
    expect(screen.getByText('7/10')).toBeInTheDocument();
  });

  it('renders action buttons (Polish, Copy, Schedule)', async () => {
    render(<PostDetailModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Polish')).toBeInTheDocument();
    });
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('shows "Publish to LinkedIn" button for draft posts', async () => {
    render(<PostDetailModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Publish to LinkedIn')).toBeInTheDocument();
    });
  });

  it('shows the post status badge', async () => {
    render(<PostDetailModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('status-badge')).toHaveTextContent('draft');
    });
  });

  it('does not show "Publish to LinkedIn" for published posts', async () => {
    const publishedPost: PipelinePost = {
      ...mockPost,
      status: 'published',
      linkedin_post_id: 'li-123',
    };
    render(<PostDetailModal {...defaultProps} post={publishedPost} />);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.queryByText('Publish to LinkedIn')).not.toBeInTheDocument();
  });

  it('renders the modal with dialog role', async () => {
    render(<PostDetailModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
