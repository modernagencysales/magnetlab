/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PostPreviewCard } from '@/components/copilot/PostPreviewCard';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('PostPreviewCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders post content preview truncated at 300 chars', () => {
    const longContent = 'A'.repeat(350);
    render(<PostPreviewCard data={{ content: longContent }} />);

    const displayed = screen.getByText(/^A+\.\.\.$/);
    // The displayed text should be 300 'A's + '...'
    expect(displayed.textContent).toBe('A'.repeat(300) + '...');
  });

  it('shows full content when under 300 chars', () => {
    const shortContent = 'This is a short post about LinkedIn growth.';
    render(<PostPreviewCard data={{ content: shortContent }} />);

    expect(screen.getByText(shortContent)).toBeInTheDocument();
    // Should NOT have ellipsis
    expect(screen.queryByText(/\.\.\.$/)).not.toBeInTheDocument();
  });

  it('shows "Apply to editor" button when onApply is provided', () => {
    const onApply = jest.fn();
    render(<PostPreviewCard data={{ content: 'Test post' }} onApply={onApply} />);

    expect(screen.getByText('Apply to editor')).toBeInTheDocument();
  });

  it('hides "Apply to editor" button when onApply is not provided', () => {
    render(<PostPreviewCard data={{ content: 'Test post' }} />);

    expect(screen.queryByText('Apply to editor')).not.toBeInTheDocument();
  });

  it('clicking Apply calls onApply with correct args', () => {
    const onApply = jest.fn();
    const content = 'My great LinkedIn post';
    const postId = 'post-123';

    render(
      <PostPreviewCard
        data={{ content, post: { id: postId, draft_content: content, status: 'draft' } }}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByText('Apply to editor'));

    expect(onApply).toHaveBeenCalledWith('post_content', { content, postId });
  });

  it('shows variation count badge when variations are present', () => {
    const data = {
      content: 'Main content',
      variations: [
        { content: 'Variation 1' },
        { content: 'Variation 2' },
        { content: 'Variation 3' },
      ],
    };

    render(<PostPreviewCard data={data} />);

    expect(screen.getByText('+3 variations')).toBeInTheDocument();
  });

  it('does not show variation badge when no variations', () => {
    render(<PostPreviewCard data={{ content: 'Just content' }} />);

    expect(screen.queryByText(/variations/)).not.toBeInTheDocument();
  });

  it('renders the Copy button', () => {
    render(<PostPreviewCard data={{ content: 'Some content' }} />);

    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('copies content to clipboard when Copy is clicked', async () => {
    const content = 'Content to copy';
    render(<PostPreviewCard data={{ content }} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);
  });

  it('falls back to post.draft_content when content is not set', () => {
    const draft = 'Draft content from post';
    render(
      <PostPreviewCard data={{ post: { id: 'p1', draft_content: draft, status: 'draft' } }} />
    );

    expect(screen.getByText(draft)).toBeInTheDocument();
  });

  it('renders "Post Preview" label with FileText icon area', () => {
    render(<PostPreviewCard data={{ content: 'Hello' }} />);

    expect(screen.getByText('Post Preview')).toBeInTheDocument();
  });
});
