/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  Edit3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-edit" {...props} />,
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-send" {...props} />,
  CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-check" {...props} />
  ),
}));

import { QueueView } from '@/components/content-queue/QueueView';
import type { QueueTeam } from '@/frontend/api/content-queue';

const mockTeams: QueueTeam[] = [
  {
    team_id: 't1',
    team_name: 'Client A',
    profile_name: 'James Rodriguez',
    profile_company: 'Apex Consulting',
    owner_id: 'o1',
    writing_style: null,
    posts: [
      {
        id: 'p1',
        draft_content: 'Post 1',
        idea_id: null,
        idea_title: null,
        idea_content_type: null,
        edited_at: null,
        created_at: '2026-03-17',
        review_data: null,
      },
      {
        id: 'p2',
        draft_content: 'Post 2',
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
            id: 'f-1',
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
  },
  {
    team_id: 't2',
    team_name: 'Client B',
    profile_name: 'Sarah Kim',
    profile_company: 'Meridian Digital',
    owner_id: 'o2',
    writing_style: null,
    posts: [],
    edited_count: 3,
    total_count: 3,
    lead_magnets: [
      {
        id: 'lm-2',
        title: 'Agency Scaling Playbook',
        archetype: 'playbook',
        status: 'published',
        reviewed_at: '2026-03-17T12:00:00Z',
        created_at: '2026-03-17',
        funnels: [
          {
            id: 'f-2',
            slug: 'agency-scaling-playbook',
            is_published: true,
            reviewed_at: '2026-03-17T12:00:00Z',
          },
        ],
      },
    ],
    lm_reviewed_count: 1,
    lm_total_count: 1,
    funnel_reviewed_count: 1,
    funnel_total_count: 1,
  },
];

const mockSummary = {
  total_teams: 2,
  total_posts: 5,
  remaining: 1,
  total_lead_magnets: 2,
  total_funnels: 2,
};

describe('QueueView', () => {
  const onEdit = jest.fn();
  const onSubmitPosts = jest.fn();
  const onSubmitAssets = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders client cards with names', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    expect(screen.getByText('James Rodriguez')).toBeInTheDocument();
    expect(screen.getByText('Sarah Kim')).toBeInTheDocument();
  });

  it('shows summary stats', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    expect(screen.getByText(/2 clients/)).toBeInTheDocument();
    expect(screen.getByText(/5 posts/)).toBeInTheDocument();
  });

  it('shows summary with lead magnet + funnel counts', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    expect(screen.getByText(/2 lead magnets/)).toBeInTheDocument();
    expect(screen.getByText(/2 funnels/)).toBeInTheDocument();
  });

  it('shows Review button for unfinished teams', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
  });

  it('shows Submit Posts for fully edited teams', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    expect(screen.getByRole('button', { name: /submit posts/i })).toBeInTheDocument();
  });

  it('shows Submit Assets when all assets reviewed', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    // Team t2 has all assets reviewed
    expect(screen.getByRole('button', { name: /submit assets/i })).toBeInTheDocument();
  });

  it('calls onEdit with team_id when Review clicked', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });

  it('calls onSubmitPosts with team_id when Submit Posts clicked', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /submit posts/i }));
    expect(onSubmitPosts).toHaveBeenCalledWith('t2');
  });

  it('calls onSubmitAssets with team_id when Submit Assets clicked', () => {
    render(
      <QueueView
        teams={mockTeams}
        summary={mockSummary}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /submit assets/i }));
    expect(onSubmitAssets).toHaveBeenCalledWith('t2');
  });

  it('renders empty state when no teams', () => {
    render(
      <QueueView
        teams={[]}
        summary={{ total_teams: 0, total_posts: 0, remaining: 0 }}
        onEdit={onEdit}
        onSubmitPosts={onSubmitPosts}
        onSubmitAssets={onSubmitAssets}
      />
    );
    expect(screen.getByText(/no posts in queue/i)).toBeInTheDocument();
  });
});
