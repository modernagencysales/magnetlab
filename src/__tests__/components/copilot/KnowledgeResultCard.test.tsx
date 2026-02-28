/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { KnowledgeResultCard } from '@/components/copilot/KnowledgeResultCard';

const makeEntries = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    content: `Knowledge entry content number ${i}. ${'Extra details here. '.repeat(10)}`,
    knowledge_type: ['how_to', 'insight', 'story', 'question'][i % 4],
    quality_score: (i % 5) + 1,
    topics: ['leadership', 'sales'],
    source_title: `Transcript ${i}`,
  }));

describe('KnowledgeResultCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders entries list with correct count', () => {
    const entries = makeEntries(5);
    render(<KnowledgeResultCard data={entries} />);

    expect(screen.getByText('Knowledge Results')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('accepts { data: entries } wrapper format', () => {
    const entries = makeEntries(3);
    render(<KnowledgeResultCard data={{ data: entries }} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows knowledge type badges', () => {
    const entries = [
      { id: '1', content: 'Short content', knowledge_type: 'how_to', quality_score: 3 },
      { id: '2', content: 'Another entry', knowledge_type: 'insight', quality_score: 4 },
    ];
    render(<KnowledgeResultCard data={entries} />);

    expect(screen.getByText('how to')).toBeInTheDocument();
    expect(screen.getByText('insight')).toBeInTheDocument();
  });

  it('shows quality stars based on score', () => {
    const entries = [
      { id: '1', content: 'Test content here', quality_score: 3 },
    ];
    render(<KnowledgeResultCard data={entries} />);

    // Should render 5 star SVGs (3 filled + 2 empty)
    const stars = document.querySelectorAll('svg');
    // Filter for Star icons - they appear within the star component
    const starContainer = document.querySelector('.flex.items-center.gap-0\\.5');
    expect(starContainer).toBeInTheDocument();
    const starIcons = starContainer?.querySelectorAll('svg');
    expect(starIcons?.length).toBe(5);
  });

  it('entries start collapsed at 100 chars', () => {
    const longContent = 'A'.repeat(150);
    const entries = [{ id: '1', content: longContent }];
    render(<KnowledgeResultCard data={entries} />);

    // Should show truncated with "..."
    const textEl = screen.getByText(/^A+\.\.\.$/);
    expect(textEl.textContent).toBe('A'.repeat(100) + '...');
  });

  it('clicking entry toggles expand/collapse', () => {
    const longContent = 'B'.repeat(150);
    const entries = [{ id: '1', content: longContent }];
    render(<KnowledgeResultCard data={entries} />);

    // Initially collapsed
    expect(screen.getByText(/^B+\.\.\.$/)).toBeInTheDocument();
    expect(screen.getByText(/Show more/)).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText(/Show more/));
    expect(screen.getByText(longContent)).toBeInTheDocument();
    expect(screen.getByText(/Show less/)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText(/Show less/));
    expect(screen.getByText(/^B+\.\.\.$/)).toBeInTheDocument();
  });

  it('shows "Use in post" when onApply is provided', () => {
    const entries = [{ id: '1', content: 'Some knowledge' }];
    const onApply = jest.fn();
    render(<KnowledgeResultCard data={entries} onApply={onApply} />);

    expect(screen.getByText('Use in post')).toBeInTheDocument();
  });

  it('does not show "Use in post" when onApply is not provided', () => {
    const entries = [{ id: '1', content: 'Some knowledge' }];
    render(<KnowledgeResultCard data={entries} />);

    expect(screen.queryByText('Use in post')).not.toBeInTheDocument();
  });

  it('clicking "Use in post" calls onApply with correct args', () => {
    const onApply = jest.fn();
    const entry = { id: 'entry-42', content: 'Valuable insight about sales' };
    render(<KnowledgeResultCard data={[entry]} onApply={onApply} />);

    fireEvent.click(screen.getByText('Use in post'));

    expect(onApply).toHaveBeenCalledWith('knowledge_reference', {
      entryId: 'entry-42',
      content: 'Valuable insight about sales',
    });
  });

  it('shows source title when available', () => {
    const entries = [
      { id: '1', content: 'Content here', source_title: 'Weekly Strategy Call' },
    ];
    render(<KnowledgeResultCard data={entries} />);

    expect(screen.getByText('Weekly Strategy Call')).toBeInTheDocument();
  });

  it('limits display to 10 entries and shows "+N more"', () => {
    const entries = makeEntries(15);
    render(<KnowledgeResultCard data={entries} />);

    // Should show count of 15 in the header badge
    expect(screen.getByText('15')).toBeInTheDocument();
    // Should show "+5 more" text
    expect(screen.getByText('+5 more')).toBeInTheDocument();
  });

  it('does not show "+N more" when 10 or fewer entries', () => {
    const entries = makeEntries(8);
    render(<KnowledgeResultCard data={entries} />);

    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });
});
