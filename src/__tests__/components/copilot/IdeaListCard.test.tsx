/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdeaListCard } from '@/components/copilot/IdeaListCard';

describe('IdeaListCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders idea titles', () => {
    const ideas = [
      { id: '1', title: '5 LinkedIn Mistakes That Kill Your Reach' },
      { id: '2', title: 'How I Booked 10 Calls From One Post' },
    ];
    render(<IdeaListCard data={ideas} />);

    expect(screen.getByText('5 LinkedIn Mistakes That Kill Your Reach')).toBeInTheDocument();
    expect(screen.getByText('How I Booked 10 Calls From One Post')).toBeInTheDocument();
  });

  it('shows content type badges', () => {
    const ideas = [
      { id: '1', title: 'Leadership post', content_type: 'thought_leadership' },
      { id: '2', title: 'Story post', content_type: 'personal_story' },
    ];
    render(<IdeaListCard data={ideas} />);

    expect(screen.getByText('thought leadership')).toBeInTheDocument();
    expect(screen.getByText('personal story')).toBeInTheDocument();
  });

  it('shows hook preview truncated at 80 chars', () => {
    const longHook = 'H'.repeat(100);
    const ideas = [{ id: '1', title: 'My Idea', hook: longHook }];
    render(<IdeaListCard data={ideas} />);

    const hookEl = screen.getByText(/^H+\.\.\.$/);
    expect(hookEl.textContent).toBe('H'.repeat(80) + '...');
  });

  it('shows full hook when under 80 chars', () => {
    const shortHook = 'Most people think LinkedIn is for job seekers. They are wrong.';
    const ideas = [{ id: '1', title: 'My Idea', hook: shortHook }];
    render(<IdeaListCard data={ideas} />);

    expect(screen.getByText(shortHook)).toBeInTheDocument();
  });

  it('"Write this" calls onApply with idea data', () => {
    const onApply = jest.fn();
    const idea = {
      id: 'idea-42',
      title: 'Growth Hack Post',
      content_type: 'how_to',
      hook: 'Here is the hook',
    };
    render(<IdeaListCard data={[idea]} onApply={onApply} />);

    fireEvent.click(screen.getByText('Write this'));

    expect(onApply).toHaveBeenCalledWith('write_from_idea', { idea });
  });

  it('does not show "Write this" when onApply is not provided', () => {
    const ideas = [{ id: '1', title: 'My Idea' }];
    render(<IdeaListCard data={ideas} />);

    expect(screen.queryByText('Write this')).not.toBeInTheDocument();
  });

  it('shows "Write this" when onApply is provided', () => {
    const ideas = [{ id: '1', title: 'My Idea' }];
    render(<IdeaListCard data={ideas} onApply={jest.fn()} />);

    expect(screen.getByText('Write this')).toBeInTheDocument();
  });

  it('renders count badge with correct number', () => {
    const ideas = [
      { id: '1', title: 'Idea 1' },
      { id: '2', title: 'Idea 2' },
      { id: '3', title: 'Idea 3' },
    ];
    render(<IdeaListCard data={ideas} />);

    expect(screen.getByText('Content Ideas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('accepts { data: ideas } wrapper format', () => {
    const ideas = [
      { id: '1', title: 'Wrapped Idea 1' },
      { id: '2', title: 'Wrapped Idea 2' },
    ];
    render(<IdeaListCard data={{ data: ideas }} />);

    expect(screen.getByText('Wrapped Idea 1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders "Content Ideas" label with Lightbulb icon area', () => {
    render(<IdeaListCard data={[{ id: '1', title: 'Test' }]} />);

    expect(screen.getByText('Content Ideas')).toBeInTheDocument();
  });

  it('handles ideas without optional fields gracefully', () => {
    const ideas = [
      { title: 'Minimal idea' },
    ];
    render(<IdeaListCard data={ideas} />);

    expect(screen.getByText('Minimal idea')).toBeInTheDocument();
    // No crash, no content type badge, no hook
    expect(screen.queryByText(/Write this/)).not.toBeInTheDocument();
  });
});
