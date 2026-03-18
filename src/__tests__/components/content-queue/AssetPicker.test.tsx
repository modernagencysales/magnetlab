/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  ArrowLeft: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-arrow-left" {...props} />
  ),
  Edit3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-edit" {...props} />,
  ExternalLink: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-external" {...props} />
  ),
  CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-check" {...props} />
  ),
  Circle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-circle" {...props} />,
}));

import { AssetPicker } from '@/components/content-queue/AssetPicker';
import type { QueueTeam } from '@/frontend/api/content-queue';

// ─── Mock Data ────────────────────────────────────────────────────────────

function makeTeam(overrides: Partial<QueueTeam> = {}): QueueTeam {
  return {
    team_id: 'team-1',
    team_name: 'Client Alpha',
    profile_name: 'Alice Johnson',
    profile_company: 'Alpha Corp',
    owner_id: 'owner-1',
    writing_style: null,
    posts: [
      {
        id: 'post-1',
        draft_content: 'Hello LinkedIn',
        idea_id: null,
        idea_title: null,
        idea_content_type: null,
        edited_at: null,
        created_at: '2026-03-17',
        review_data: null,
      },
      {
        id: 'post-2',
        draft_content: 'Second post',
        idea_id: null,
        idea_title: null,
        idea_content_type: null,
        edited_at: '2026-03-17T10:00:00Z',
        created_at: '2026-03-17',
        review_data: null,
      },
    ],
    edited_count: 1,
    total_count: 2,
    lead_magnets: [
      {
        id: 'lm-1',
        title: 'LinkedIn Growth Guide',
        archetype: 'how_to_guide',
        status: 'draft',
        reviewed_at: null,
        created_at: '2026-03-17',
        funnels: [
          {
            id: 'funnel-1',
            slug: 'linkedin-growth-guide',
            is_published: false,
            reviewed_at: null,
          },
        ],
      },
    ],
    lm_reviewed_count: 0,
    lm_total_count: 1,
    funnel_reviewed_count: 0,
    funnel_total_count: 1,
    ...overrides,
  };
}

const defaultProps = {
  onEditPosts: jest.fn(),
  onBack: jest.fn(),
  onReviewLeadMagnet: jest.fn().mockResolvedValue(undefined),
  onReviewFunnel: jest.fn().mockResolvedValue(undefined),
  onSubmitPosts: jest.fn().mockResolvedValue(undefined),
  onSubmitAssets: jest.fn().mockResolvedValue(undefined),
};

describe('AssetPicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders profile name and company', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
  });

  it('renders posts section with count', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    expect(screen.getByText(/2 posts · 1 edited/)).toBeInTheDocument();
  });

  it('renders lead magnets section', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    expect(screen.getByText('LinkedIn Growth Guide')).toBeInTheDocument();
    expect(screen.getByText(/how to guide/i)).toBeInTheDocument();
  });

  it('renders funnel for the lead magnet', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    expect(screen.getByText('/linkedin-growth-guide')).toBeInTheDocument();
  });

  it('calls onEditPosts when Edit Posts clicked', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit posts/i }));
    expect(defaultProps.onEditPosts).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Back clicked', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /back to queue/i }));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('shows disabled Submit Posts when posts not all edited', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /submit posts/i });
    expect(btn).toBeDisabled();
  });

  it('shows enabled Submit Posts when all posts edited', () => {
    const team = makeTeam({ edited_count: 2, total_count: 2 });
    render(<AssetPicker team={team} {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /submit posts/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows disabled Submit Assets when assets not all reviewed', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /submit assets/i });
    expect(btn).toBeDisabled();
  });

  it('shows enabled Submit Assets when all assets reviewed', () => {
    const team = makeTeam({
      lm_reviewed_count: 1,
      lm_total_count: 1,
      funnel_reviewed_count: 1,
      funnel_total_count: 1,
      lead_magnets: [
        {
          id: 'lm-1',
          title: 'LinkedIn Growth Guide',
          archetype: 'how_to_guide',
          status: 'published',
          reviewed_at: '2026-03-17T12:00:00Z',
          created_at: '2026-03-17',
          funnels: [
            {
              id: 'funnel-1',
              slug: 'linkedin-growth-guide',
              is_published: true,
              reviewed_at: '2026-03-17T12:00:00Z',
            },
          ],
        },
      ],
    });
    render(<AssetPicker team={team} {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /submit assets/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows Mark Reviewed buttons for lead magnet and funnel', () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    const markReviewedBtns = screen.getAllByText(/mark reviewed/i);
    // One for lead magnet, one for funnel
    expect(markReviewedBtns.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onReviewLeadMagnet when Mark Reviewed toggled for LM', async () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    const btn = screen.getByRole('button', {
      name: /mark lead magnet linkedin growth guide as reviewed/i,
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(defaultProps.onReviewLeadMagnet).toHaveBeenCalledWith('lm-1', true);
    });
  });

  it('calls onReviewFunnel when Mark Reviewed toggled for funnel', async () => {
    render(<AssetPicker team={makeTeam()} {...defaultProps} />);
    const btn = screen.getByRole('button', {
      name: /mark funnel \/linkedin-growth-guide as reviewed/i,
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(defaultProps.onReviewFunnel).toHaveBeenCalledWith('funnel-1', true);
    });
  });

  it('calls onSubmitPosts when Submit Posts clicked and posts complete', async () => {
    const team = makeTeam({ edited_count: 2, total_count: 2 });
    render(<AssetPicker team={team} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /submit posts/i }));
    await waitFor(() => {
      expect(defaultProps.onSubmitPosts).toHaveBeenCalledTimes(1);
    });
  });

  it('does not show Submit Assets button when team has no lead magnets', () => {
    const team = makeTeam({
      lead_magnets: [],
      lm_total_count: 0,
      lm_reviewed_count: 0,
      funnel_total_count: 0,
      funnel_reviewed_count: 0,
    });
    render(<AssetPicker team={team} {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /submit assets/i })).not.toBeInTheDocument();
  });
});
