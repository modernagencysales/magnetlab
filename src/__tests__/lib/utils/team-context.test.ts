/**
 * @jest-environment node
 *
 * Tests for applyScope() — MOD-95: Lead magnets not visible on library page.
 *
 * Root cause: applyScope() in personal mode filters with
 *   .eq('user_id', userId).is('team_id', null)
 * This hides magnets that were created with a team_id set (e.g. after the
 * multi-team migration backfilled team_id on existing rows, or when a team
 * owner creates a magnet while in team context). When the user later visits
 * the magnets page without the ml-team-context cookie, they see zero results.
 *
 * Expected: Personal mode should show all magnets owned by the user,
 * regardless of team_id value.
 */

import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

// Minimal chainable mock that records which filter methods were called
function createMockQuery() {
  const calls: { method: string; args: unknown[] }[] = [];

  const chain: Record<string, jest.Mock> = {};

  const makeMethod = (name: string) => {
    const fn = jest.fn((...args: unknown[]) => {
      calls.push({ method: name, args });
      return chain;
    });
    return fn;
  };

  chain.eq = makeMethod('eq');
  chain.is = makeMethod('is');
  chain.or = makeMethod('or');

  return { chain, calls };
}

describe('applyScope', () => {
  describe('team mode', () => {
    it('filters by team_id only', () => {
      const { chain, calls } = createMockQuery();
      const scope: DataScope = {
        type: 'team',
        userId: 'user-1',
        teamId: 'team-1',
        ownerId: 'owner-1',
      };

      applyScope(chain, scope);

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ method: 'eq', args: ['team_id', 'team-1'] });
    });
  });

  describe('personal mode (no team context)', () => {
    const personalScope: DataScope = {
      type: 'user',
      userId: 'user-1',
    };

    it('filters by user_id', () => {
      const { chain, calls } = createMockQuery();

      applyScope(chain, personalScope);

      // Must include user_id filter
      const userIdFilter = calls.find(
        (c) => c.method === 'eq' && c.args[0] === 'user_id'
      );
      expect(userIdFilter).toBeDefined();
      expect(userIdFilter!.args[1]).toBe('user-1');
    });

    /**
     * BUG (MOD-95): This test currently FAILS.
     *
     * applyScope() adds .is('team_id', null) in personal mode, which
     * excludes magnets that have a non-null team_id. Users who own a team
     * have all their magnets backfilled with team_id, so the query returns
     * zero rows and the magnets page shows "No lead magnets yet".
     *
     * Fix: Personal mode should NOT require team_id IS NULL. It should
     * show all magnets where user_id matches, regardless of team_id.
     */
    it('should NOT exclude magnets that have a team_id set', () => {
      const { chain, calls } = createMockQuery();

      applyScope(chain, personalScope);

      // The bug: applyScope adds .is('team_id', null) which hides
      // magnets where team_id is a UUID (e.g. after backfill migration)
      const teamIdNullFilter = calls.find(
        (c) => c.method === 'is' && c.args[0] === 'team_id' && c.args[1] === null
      );

      // This assertion currently FAILS — applyScope DOES add the null filter
      expect(teamIdNullFilter).toBeUndefined();
    });

    it('should show magnets owned by user even if team_id is set', () => {
      // Simulate what the magnets page does: build a query, apply scope,
      // then check that a magnet with team_id would NOT be filtered out.
      const { chain, calls } = createMockQuery();

      applyScope(chain, personalScope);

      // Count how many filters were applied. The bug adds 2 filters:
      // .eq('user_id', ...) AND .is('team_id', null)
      // The fix should only add 1 filter: .eq('user_id', ...)
      // OR use an .or() clause that includes both personal and team magnets
      const isNullCalls = calls.filter(
        (c) => c.method === 'is' && c.args[0] === 'team_id' && c.args[1] === null
      );

      // This currently FAILS — there IS an .is('team_id', null) call
      expect(isNullCalls).toHaveLength(0);
    });
  });
});
