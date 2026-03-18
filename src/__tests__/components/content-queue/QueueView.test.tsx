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
        image_urls: null,
      },
      {
        id: 'p2',
        draft_content: 'Post 2',
        idea_id: null,
        idea_title: null,
        idea_content_type: null,
        edited_at: '2026-03-17T10:00:00Z',
        created_at: '2026-03-17',
        image_urls: null,
      },
    ],
    edited_count: 1,
    total_count: 2,
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
  },
];

const mockSummary = { total_teams: 2, total_posts: 5, remaining: 1 };

describe('QueueView', () => {
  const onEdit = jest.fn();
  const onSubmit = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders client cards with names', () => {
    render(
      <QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />
    );
    expect(screen.getByText('James Rodriguez')).toBeInTheDocument();
    expect(screen.getByText('Sarah Kim')).toBeInTheDocument();
  });

  it('shows summary stats', () => {
    render(
      <QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />
    );
    expect(screen.getByText(/2 clients/)).toBeInTheDocument();
    expect(screen.getByText(/5 posts/)).toBeInTheDocument();
  });

  it('shows Edit button for unfinished teams', () => {
    render(
      <QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('shows Submit for Review for fully edited teams', () => {
    render(
      <QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />
    );
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
  });

  it('calls onEdit with team_id when Edit clicked', () => {
    render(
      <QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });

  it('calls onSubmit with team_id when Submit clicked', () => {
    render(
      <QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />
    );
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));
    expect(onSubmit).toHaveBeenCalledWith('t2');
  });

  it('renders empty state when no teams', () => {
    render(
      <QueueView
        teams={[]}
        summary={{ total_teams: 0, total_posts: 0, remaining: 0 }}
        onEdit={onEdit}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByText(/no posts in queue/i)).toBeInTheDocument();
  });
});
