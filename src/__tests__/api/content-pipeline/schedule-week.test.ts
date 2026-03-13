/**
 * @jest-environment node
 *
 * Tests for POST /api/content-pipeline/posts/schedule-week
 * Compound action: create posts + distribute across posting slots.
 */

import { POST } from '@/app/api/content-pipeline/posts/schedule-week/route';
import { ScheduleWeekSchema } from '@/lib/validations/api';
import { NextRequest } from 'next/server';

// ─── Mocks ─────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Mock Supabase builder ──────────────────────────────────────────────────

/**
 * Builds a chainable mock Supabase client that supports:
 *   - select (list) queries with chained .eq/.order/.limit
 *   - insert → select → single (create post)
 *   - update → eq → eq → select → single (update post)
 *
 * All results are overridable per-call via a queue or fixed value.
 */
function createMockSupabase() {
  // Queue of results for ordered calls
  const slotsResult = { data: [] as unknown[], error: null as unknown };
  const insertResults: Array<{ data: unknown; error: unknown }> = [];
  const updateResults: Array<{ data: unknown; error: unknown }> = [];

  let insertCallIdx = 0;
  let updateCallIdx = 0;

  function buildSelectChain(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.in = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.single = jest.fn(() => Promise.resolve(result));
    // Make thenable for `await supabase.from(...).select(...).eq(...).order(...)`
    Object.defineProperty(chain, 'then', {
      value: (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      enumerable: false,
    });
    return chain;
  }

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'cp_posting_slots') {
        return buildSelectChain(slotsResult);
      }

      if (table === 'cp_pipeline_posts') {
        // Return a dual-mode chain that handles both insert and update
        const chain: Record<string, unknown> = {};

        chain.insert = jest.fn(() => {
          const result = insertResults[insertCallIdx++] ?? {
            data: null,
            error: { message: 'no insert result configured' },
          };
          const innerChain: Record<string, unknown> = {};
          innerChain.select = jest.fn(() => innerChain);
          innerChain.single = jest.fn(() => Promise.resolve(result));
          return innerChain;
        });

        chain.update = jest.fn(() => {
          const result = updateResults[updateCallIdx++] ?? {
            data: null,
            error: { message: 'no update result configured' },
          };
          const innerChain: Record<string, unknown> = {};
          innerChain.eq = jest.fn(() => innerChain);
          innerChain.select = jest.fn(() => innerChain);
          innerChain.single = jest.fn(() => Promise.resolve(result));
          return innerChain;
        });

        return chain;
      }

      // Default empty chain
      return buildSelectChain({ data: null, error: null });
    }),
  };

  return {
    client,
    setSlots: (slots: unknown[], error?: unknown) => {
      slotsResult.data = slots;
      slotsResult.error = error ?? null;
    },
    pushInsert: (result: { data: unknown; error: unknown }) => {
      insertResults.push(result);
    },
    pushUpdate: (result: { data: unknown; error: unknown }) => {
      updateResults.push(result);
    },
  };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const MOCK_SLOTS = [
  {
    id: 'slot-1',
    user_id: 'user-1',
    slot_number: 1,
    day_of_week: 1,
    time_of_day: '09:00',
    timezone: 'UTC',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'slot-2',
    user_id: 'user-1',
    slot_number: 2,
    day_of_week: 3,
    time_of_day: '09:00',
    timezone: 'UTC',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'slot-3',
    user_id: 'user-1',
    slot_number: 3,
    day_of_week: 5,
    time_of_day: '09:00',
    timezone: 'UTC',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

function makeMockPost(id: string, body: string) {
  return {
    id,
    user_id: 'user-1',
    draft_content: body,
    final_content: null,
    status: 'draft',
    source: 'agent',
    agent_metadata: null,
    idea_id: null,
    dm_template: null,
    cta_word: null,
    variations: null,
    hook_score: null,
    polish_status: null,
    polish_notes: null,
    is_buffer: false,
    buffer_position: null,
    scheduled_time: null,
    auto_publish_after: null,
    linkedin_post_id: null,
    publish_provider: null,
    lead_magnet_id: null,
    published_at: null,
    engagement_stats: null,
    team_profile_id: null,
    created_at: '2026-03-13T00:00:00Z',
    updated_at: '2026-03-13T00:00:00Z',
  };
}

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/content-pipeline/posts/schedule-week', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Test setup ─────────────────────────────────────────────────────────────

let mock: ReturnType<typeof createMockSupabase>;

describe('POST /api/content-pipeline/posts/schedule-week', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  // ─── Auth ─────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(buildRequest({ posts: [{ body: 'test' }] }));

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  // ─── Validation ───────────────────────────────────────────────────────

  it('returns 400 when posts array is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/posts/i);
  });

  it('returns 400 when posts array is empty', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(buildRequest({ posts: [] }));

    expect(response.status).toBe(400);
  });

  it('returns 400 when posts array exceeds 7', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    const posts = Array.from({ length: 8 }, (_, i) => ({ body: `Post ${i}` }));

    const response = await POST(buildRequest({ posts }));

    expect(response.status).toBe(400);
  });

  it('returns 400 when a post body is empty', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(buildRequest({ posts: [{ body: '' }] }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/body/i);
  });

  it('returns 400 when week_start format is invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(
      buildRequest({ posts: [{ body: 'Post' }], week_start: '16-03-2026' })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/week_start/i);
  });

  // ─── No slots ─────────────────────────────────────────────────────────

  it('returns 400 when user has no active posting slots', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSlots([]); // no slots

    const response = await POST(
      buildRequest({
        posts: [{ body: 'My post' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/slot/i);
  });

  it('returns 400 when all active slots have no day_of_week', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSlots([
      {
        id: 'slot-1',
        user_id: 'user-1',
        slot_number: 1,
        day_of_week: null,
        time_of_day: '09:00',
        timezone: 'UTC',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const response = await POST(
      buildRequest({
        posts: [{ body: 'My post' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/day_of_week/i);
  });

  // ─── Success ──────────────────────────────────────────────────────────

  it('creates and schedules a single post into the first available slot', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSlots(MOCK_SLOTS);
    mock.pushInsert({ data: makeMockPost('post-1', 'My first post'), error: null });
    mock.pushUpdate({
      data: {
        ...makeMockPost('post-1', 'My first post'),
        status: 'scheduled',
        scheduled_time: '2026-03-16T09:00:00.000Z',
      },
      error: null,
    });

    const response = await POST(
      buildRequest({
        posts: [{ body: 'My first post' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.scheduled_posts).toHaveLength(1);
    expect(data.scheduled_posts[0].id).toBe('post-1');
    expect(data.scheduled_posts[0].slot_day).toBe('Monday');
    expect(data.scheduled_posts[0].scheduled_for).toContain('2026-03-16');
    expect(data.slots_used).toBe(1);
    expect(data.slots_available).toBe(3);
  });

  it('distributes multiple posts across multiple slots', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSlots(MOCK_SLOTS);

    for (let i = 1; i <= 3; i++) {
      mock.pushInsert({ data: makeMockPost(`post-${i}`, `Post ${i}`), error: null });
      mock.pushUpdate({
        data: { ...makeMockPost(`post-${i}`, `Post ${i}`), status: 'scheduled' },
        error: null,
      });
    }

    const response = await POST(
      buildRequest({
        posts: [{ body: 'Post 1' }, { body: 'Post 2' }, { body: 'Post 3' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.scheduled_posts).toHaveLength(3);
    expect(data.slots_used).toBe(3);
    expect(data.slots_available).toBe(3);
    expect(data.overflow).toBeUndefined();

    // Slots 1=Monday(1), 2=Wednesday(3), 3=Friday(5)
    expect(data.scheduled_posts[0].slot_day).toBe('Monday');
    expect(data.scheduled_posts[1].slot_day).toBe('Wednesday');
    expect(data.scheduled_posts[2].slot_day).toBe('Friday');
  });

  it('schedules what fits and reports overflow when more posts than slots', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    // Only 2 slots
    mock.setSlots(MOCK_SLOTS.slice(0, 2));

    for (let i = 1; i <= 2; i++) {
      mock.pushInsert({ data: makeMockPost(`post-${i}`, `Post ${i}`), error: null });
      mock.pushUpdate({
        data: { ...makeMockPost(`post-${i}`, `Post ${i}`), status: 'scheduled' },
        error: null,
      });
    }

    const response = await POST(
      buildRequest({
        posts: [{ body: 'Post 1' }, { body: 'Post 2' }, { body: 'Post 3' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.scheduled_posts).toHaveLength(2);
    expect(data.slots_used).toBe(2);
    expect(data.slots_available).toBe(2);
    expect(data.overflow).toBe(1);
  });

  it('uses the week_start date to anchor the schedule', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSlots([
      {
        id: 'slot-1',
        user_id: 'user-1',
        slot_number: 1,
        day_of_week: 2,
        time_of_day: '10:00',
        timezone: 'UTC',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mock.pushInsert({ data: makeMockPost('post-x', 'Anchored post'), error: null });
    mock.pushUpdate({
      data: {
        ...makeMockPost('post-x', 'Anchored post'),
        status: 'scheduled',
        scheduled_time: '2026-03-17T10:00:00.000Z',
      },
      error: null,
    });

    const response = await POST(
      buildRequest({
        posts: [{ body: 'Anchored post' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    // day_of_week=2 (Tuesday), week starting 2026-03-16 (Mon) → 2026-03-17
    expect(data.scheduled_posts[0].scheduled_for).toContain('2026-03-17');
    expect(data.scheduled_posts[0].slot_day).toBe('Tuesday');
  });

  it('ignores inactive slots', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSlots([
      {
        id: 'slot-1',
        user_id: 'user-1',
        slot_number: 1,
        day_of_week: 1,
        time_of_day: '09:00',
        timezone: 'UTC',
        is_active: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'slot-2',
        user_id: 'user-1',
        slot_number: 2,
        day_of_week: 3,
        time_of_day: '09:00',
        timezone: 'UTC',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mock.pushInsert({ data: makeMockPost('post-1', 'Post'), error: null });
    mock.pushUpdate({
      data: { ...makeMockPost('post-1', 'Post'), status: 'scheduled' },
      error: null,
    });

    const response = await POST(
      buildRequest({
        posts: [{ body: 'Post' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.slots_available).toBe(1);
    expect(data.scheduled_posts[0].slot_day).toBe('Wednesday');
  });

  it('returns 500 when slots DB query fails', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSlots([], { message: 'DB error' });

    const response = await POST(
      buildRequest({
        posts: [{ body: 'Post' }],
        week_start: '2026-03-16',
      })
    );

    expect(response.status).toBe(500);
  });
});

// ─── Zod schema tests ────────────────────────────────────────────────────────

describe('ScheduleWeekSchema validation', () => {
  it('accepts minimal valid input', () => {
    const result = ScheduleWeekSchema.safeParse({ posts: [{ body: 'Post content' }] });
    expect(result.success).toBe(true);
  });

  it('accepts full valid input with week_start', () => {
    const result = ScheduleWeekSchema.safeParse({
      posts: [
        { body: 'Post 1', title: 'Title', pillar: 'teaching_promotion', content_type: 'insight' },
      ],
      week_start: '2026-03-16',
    });
    expect(result.success).toBe(true);
  });

  it('accepts exactly 7 posts', () => {
    const posts = Array.from({ length: 7 }, (_, i) => ({ body: `Post ${i + 1}` }));
    const result = ScheduleWeekSchema.safeParse({ posts });
    expect(result.success).toBe(true);
  });

  it('rejects 8 posts', () => {
    const posts = Array.from({ length: 8 }, (_, i) => ({ body: `Post ${i + 1}` }));
    const result = ScheduleWeekSchema.safeParse({ posts });
    expect(result.success).toBe(false);
  });

  it('rejects empty posts array', () => {
    const result = ScheduleWeekSchema.safeParse({ posts: [] });
    expect(result.success).toBe(false);
  });

  it('rejects missing posts field', () => {
    const result = ScheduleWeekSchema.safeParse({ week_start: '2026-03-16' });
    expect(result.success).toBe(false);
  });

  it('rejects empty body in a post item', () => {
    const result = ScheduleWeekSchema.safeParse({ posts: [{ body: '' }] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid pillar in a post item', () => {
    const result = ScheduleWeekSchema.safeParse({
      posts: [{ body: 'Content', pillar: 'bad_pillar' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid content_type in a post item', () => {
    const result = ScheduleWeekSchema.safeParse({
      posts: [{ body: 'Content', content_type: 'bad_type' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed week_start (DD-MM-YYYY)', () => {
    const result = ScheduleWeekSchema.safeParse({
      posts: [{ body: 'Content' }],
      week_start: '16-03-2026',
    });
    expect(result.success).toBe(false);
  });

  it('accepts week_start omitted (optional)', () => {
    const result = ScheduleWeekSchema.safeParse({ posts: [{ body: 'Content' }] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.week_start).toBeUndefined();
  });
});
