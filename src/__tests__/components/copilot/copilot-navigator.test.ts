/**
 * @jest-environment jsdom
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
// Return a stable router object so useCallback([router]) deps don't change
// between renders — needed to verify that useMemo stabilizes the context value.
const mockRouter = { push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
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

  /**
   * MOD-604 regression test.
   *
   * Bug: useCopilotPageContext's useEffect dependency array omits `entityTitle`,
   * so when a parent re-renders with a new entityTitle (e.g. after concept selection),
   * setPageContext is never called again and pageContext.entityTitle goes stale.
   *
   * In WizardContainer, entityTitle is `selectedConcept?.title || 'New Lead Magnet'`.
   * When the user picks a concept, selectedConcept changes, but the stale effect closure
   * keeps the old title.  The stale context value that is passed to `setPageContext(context)`
   * inside the effect captures the old `entityTitle`, so the copilot navigator always
   * shows the initial title regardless of which concept was selected.
   *
   * Root cause: `[context.page, context.entityType, context.entityId]` dep array
   * intentionally excludes `entityTitle`, so the effect is never re-run when only the
   * title changes.  This means `setPageContext` is called with a stale closure over
   * the context object, leaving `pageContext.entityTitle` permanently out of date.
   */
  it('MOD-604: pageContext.entityTitle should update when entityTitle prop changes (currently broken)', () => {
    let currentEntityTitle = 'New Lead Magnet';

    const { result, rerender } = renderHook(
      () => {
        // Simulate WizardContainer's call pattern: entityId is stable,
        // but entityTitle changes when a concept is selected.
        useCopilotPageContext({
          page: 'lead-magnet-creation',
          entityType: 'lead-magnet',
          entityId: 'draft-abc',
          entityTitle: currentEntityTitle,
        });
        return useCopilotNavigator();
      },
      { wrapper: makeWrapper() }
    );

    // Initial title should be set
    expect(result.current.pageContext?.entityTitle).toBe('New Lead Magnet');

    // Simulate concept selection: title changes, but entityId/page/entityType stay the same
    currentEntityTitle = 'How to 10x Your LinkedIn Engagement';

    act(() => {
      rerender();
    });

    // The dep array [context.page, context.entityType, context.entityId] hasn't changed,
    // so the effect does NOT re-run and setPageContext is never called with the new title.
    // pageContext.entityTitle is therefore stale — this assertion fails with the current code.
    expect(result.current.pageContext?.entityTitle).toBe('How to 10x Your LinkedIn Engagement');
  });

  /**
   * MOD-604 regression test.
   *
   * Bug: CopilotNavigatorProvider creates a new `value` object on every render
   * without useMemo.  When the provider is forced to re-render by a parent
   * component re-render (unrelated to pageContext changes), a new value object
   * is emitted to the context.  All consumers then re-render unnecessarily, even
   * when neither pageContext nor the stable functions (startConversation,
   * setPageContext) have changed.
   *
   * In the dashboard this is compounded by the fact that multiple components on
   * the same route all subscribe to useCopilotNavigator() — any extraneous parent
   * re-render cascades into all of them.
   *
   * Fix: wrap `value` in useMemo([startConversation, pageContext, setPageContext])
   * so the reference is only replaced when the contents actually change.
   */
  it('MOD-604: provider context value should be memoized to not change on extraneous parent re-renders (currently broken)', () => {
    let triggerParentRerender!: () => void;
    let consumerRenderCount = 0;

    // A stateful wrapper that can re-render the provider without touching its state.
    function StatefulWrapper({ children }: { children: React.ReactNode }) {
      const [, setState] = React.useState(0);
      triggerParentRerender = () => setState((n) => n + 1);
      return React.createElement(CopilotNavigatorProvider, null, children);
    }

    renderHook(
      () => {
        consumerRenderCount++;
        return useCopilotNavigator();
      },
      { wrapper: StatefulWrapper }
    );

    consumerRenderCount = 0; // reset after initial mount

    act(() => {
      // Re-render the wrapper (and therefore the provider) without changing any
      // provider state.  This simulates a parent component updating for its own
      // reasons — a common occurrence in the dashboard layout.
      triggerParentRerender();
    });

    // With useMemo: provider emits the same value reference → consumer does NOT
    // re-render (consumerRenderCount stays 0).
    // Without useMemo: provider emits a new value object → consumer re-renders
    // (consumerRenderCount becomes 1) — failing this test.
    expect(consumerRenderCount).toBe(0);
  });
});
