/**
 * @jest-environment jsdom
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  CopilotNavigatorProvider,
  useCopilotNavigator,
  useCopilotPageContext,
} from '@/components/copilot/CopilotNavigator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(CopilotNavigatorProvider, null, children);
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCopilotNavigator', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('pageContext is null by default', () => {
    const { result } = renderHook(() => useCopilotNavigator(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.pageContext).toBeNull();
  });

  it('setPageContext updates pageContext', () => {
    const { result } = renderHook(() => useCopilotNavigator(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.setPageContext({
        page: 'library',
        entityType: 'lead_magnet',
        entityId: 'lm-1',
      });
    });

    expect(result.current.pageContext).toEqual({
      page: 'library',
      entityType: 'lead_magnet',
      entityId: 'lm-1',
    });
  });

  it('startConversation calls router.push with encoded message', () => {
    const { result } = renderHook(() => useCopilotNavigator(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.startConversation('Hello world');
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      `/copilot/new?message=${encodeURIComponent('Hello world')}`
    );
  });

  it('startConversation with context appends encoded context to URL', () => {
    const { result } = renderHook(() => useCopilotNavigator(), {
      wrapper: makeWrapper(),
    });

    const context = { page: 'library', entityType: 'lead_magnet', entityId: 'lm-42' };

    act(() => {
      result.current.startConversation('Tell me about this', context);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      `/copilot/new?message=${encodeURIComponent('Tell me about this')}&context=${encodeURIComponent(JSON.stringify(context))}`
    );
  });

  it('throws when used outside of CopilotNavigatorProvider', () => {
    // Suppress the expected error from React
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCopilotNavigator())).toThrow(
      'useCopilotNavigator must be used within CopilotNavigatorProvider'
    );
    consoleSpy.mockRestore();
  });
});

describe('useCopilotPageContext', () => {
  it('registers page context on mount and clears on unmount', () => {
    const ctx = { page: 'funnel', entityType: 'funnel_page', entityId: 'fp-1' };

    const { result, unmount } = renderHook(
      () => {
        useCopilotPageContext(ctx);
        return useCopilotNavigator();
      },
      { wrapper: makeWrapper() }
    );

    expect(result.current.pageContext).toEqual(ctx);

    act(() => {
      unmount();
    });
  });
});
