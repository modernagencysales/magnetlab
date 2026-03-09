/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  Brain: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="brain" {...props} />,
  Plus: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="plus" {...props} />,
  Trash2: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="trash" {...props} />,
  ToggleLeft: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="toggle-left" {...props} />,
  ToggleRight: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="toggle-right" {...props} />,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { CopilotMemorySettings } from '@/components/settings/CopilotMemorySettings';

describe('CopilotMemorySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        memories: [
          { id: 'm1', rule: 'No bullet points', category: 'structure', confidence: 0.9, source: 'conversation', active: true, created_at: '2026-02-28T00:00:00Z' },
          { id: 'm2', rule: 'Use casual tone', category: 'tone', confidence: 1.0, source: 'manual', active: true, created_at: '2026-02-27T00:00:00Z' },
        ],
      }),
    });
  });

  it('renders memories list', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText('No bullet points')).toBeInTheDocument();
      expect(screen.getByText('Use casual tone')).toBeInTheDocument();
    });
  });

  it('shows category badges', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText('structure')).toBeInTheDocument();
      expect(screen.getByText('tone')).toBeInTheDocument();
    });
  });

  it('shows source labels', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText(/auto-learned/i)).toBeInTheDocument();
      // "manual" appears in both the description paragraph and the source label
      const manualElements = screen.getAllByText(/manual/i);
      expect(manualElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows add memory form when button clicked', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => screen.getByText('No bullet points'));

    fireEvent.click(screen.getByText(/add preference/i));
    expect(screen.getByPlaceholderText(/never use bullet/i)).toBeInTheDocument();
  });

  it('renders empty state when no memories', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ memories: [] }),
    });

    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText(/no learned preferences/i)).toBeInTheDocument();
    });
  });

  it('renders toggle and delete buttons for each memory', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => {
      const deactivateButtons = screen.getAllByLabelText('Deactivate');
      expect(deactivateButtons).toHaveLength(2);
      const deleteButtons = screen.getAllByLabelText('Delete');
      expect(deleteButtons).toHaveLength(2);
    });
  });
});
