/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import '@/lib/actions/scheduling';
import type { ActionContext } from '@/lib/actions/types';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Repo mocks ──────────────────────────────────────────────────────────────

jest.mock('@/server/repositories/posts.repo', () => ({
  findPosts: jest.fn().mockResolvedValue([
    { id: 'buf-1', is_buffer: true, status: 'draft' },
    { id: 'buf-2', is_buffer: true, status: 'draft' },
  ]),
  updatePost: jest.fn().mockResolvedValue({ id: 'post-1' }),
}));

jest.mock('@/server/repositories/cp-schedule-slots.repo', () => ({
  listSlots: jest.fn().mockResolvedValue({
    data: [
      { id: 'slot-1', day_of_week: 1, time_of_day: '09:00', is_active: true },
      { id: 'slot-2', day_of_week: 3, time_of_day: '10:00', is_active: true },
    ],
    error: null,
  }),
}));

jest.mock('@/server/repositories/cp-team-schedule.repo', () => ({
  getActiveProfiles: jest.fn().mockResolvedValue({
    data: [{ id: 'profile-1' }, { id: 'profile-2' }],
    error: null,
  }),
  getSlots: jest.fn().mockResolvedValue({
    data: [
      { id: 'slot-t1', team_profile_id: 'profile-1', day_of_week: 2, time_of_day: '08:00', is_active: true },
    ],
    error: null,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const userScope: DataScope = { type: 'user', userId: 'user-1' };
const teamScope: DataScope = { type: 'team', userId: 'user-1', teamId: 'team-1' };

const ctxUser: ActionContext = { scope: userScope };
const ctxTeam: ActionContext = { scope: teamScope };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Scheduling Actions', () => {
  describe('schedule_post', () => {
    it('schedules a post via updatePost repo', async () => {
      const result = await executeAction(ctxUser, 'schedule_post', {
        post_id: 'post-1',
        scheduled_time: '2026-04-01T09:00:00Z',
      });
      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('calendar');
    });

    it('calls updatePost with userId from scope', async () => {
      const { updatePost } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'schedule_post', {
        post_id: 'post-1',
        scheduled_time: '2026-04-01T09:00:00Z',
      });
      expect(updatePost).toHaveBeenCalledWith(
        'user-1',
        'post-1',
        expect.objectContaining({ status: 'scheduled', scheduled_time: '2026-04-01T09:00:00Z' })
      );
    });

    it('returns error when updatePost throws', async () => {
      const { updatePost } = jest.requireMock('@/server/repositories/posts.repo');
      updatePost.mockRejectedValueOnce(new Error('Post not found'));
      const result = await executeAction(ctxUser, 'schedule_post', {
        post_id: 'missing',
        scheduled_time: '2026-04-01T09:00:00Z',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Post not found');
    });

    it('returns scheduled data in response', async () => {
      const result = await executeAction(ctxUser, 'schedule_post', {
        post_id: 'post-1',
        scheduled_time: '2026-04-01T09:00:00Z',
      });
      const data = result.data as { post_id: string; status: string; scheduled_time: string };
      expect(data.post_id).toBe('post-1');
      expect(data.status).toBe('scheduled');
    });
  });

  describe('get_autopilot_status', () => {
    it('returns buffer count and slots (user scope)', async () => {
      const result = await executeAction(ctxUser, 'get_autopilot_status', {});
      expect(result.success).toBe(true);
      const data = result.data as { buffer_count: number; slots: unknown[] };
      expect(data.buffer_count).toBe(2);
      expect(Array.isArray(data.slots)).toBe(true);
    });

    it('calls findPosts with isBuffer filter and user scope', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'get_autopilot_status', {});
      expect(findPosts).toHaveBeenCalledWith(userScope, { isBuffer: true });
    });

    it('uses listSlots for user scope', async () => {
      const { listSlots } = jest.requireMock('@/server/repositories/cp-schedule-slots.repo');
      await executeAction(ctxUser, 'get_autopilot_status', {});
      expect(listSlots).toHaveBeenCalledWith('user-1');
    });

    it('uses getActiveProfiles + getSlots for team scope', async () => {
      const { getActiveProfiles, getSlots } = jest.requireMock('@/server/repositories/cp-team-schedule.repo');
      await executeAction(ctxTeam, 'get_autopilot_status', {});
      expect(getActiveProfiles).toHaveBeenCalledWith('team-1');
      expect(getSlots).toHaveBeenCalledWith(['profile-1', 'profile-2']);
    });

    it('returns team slots for team scope', async () => {
      const result = await executeAction(ctxTeam, 'get_autopilot_status', {});
      const data = result.data as { buffer_count: number; slots: Array<{ id: string }> };
      expect(data.slots[0].id).toBe('slot-t1');
    });

    it('calls findPosts with team scope for buffer posts', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxTeam, 'get_autopilot_status', {});
      expect(findPosts).toHaveBeenCalledWith(teamScope, { isBuffer: true });
    });
  });
});
