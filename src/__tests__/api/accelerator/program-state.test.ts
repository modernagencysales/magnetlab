/**
 * @jest-environment node
 */

/** Tests for GET /api/accelerator/program-state
 *  Covers: unenrolled (enrolled:false), enrolled (enrolled:true + state), unauthorized (401). */

import { GET } from '@/app/api/accelerator/program-state/route';

// ─── Mocks ───────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/services/accelerator-program', () => ({
  getProgramState: jest.fn(),
}));

jest.mock('@/lib/api/errors', () => {
  const actual = jest.requireActual('@/lib/api/errors');
  return actual;
});

import { auth } from '@/lib/auth';
import { getProgramState } from '@/lib/services/accelerator-program';

// ─── Tests ───────────────────────────────────────────────

describe('GET /api/accelerator/program-state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the user is unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe('UNAUTHORIZED');
    expect(getProgramState).not.toHaveBeenCalled();
  });

  it('returns enrolled:false and programState:null when user has no enrollment', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-unenrolled' } });
    (getProgramState as jest.Mock).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.enrolled).toBe(false);
    expect(data.programState).toBeNull();
    expect(getProgramState).toHaveBeenCalledWith('user-unenrolled');
  });

  it('returns enrolled:true and programState when user is enrolled', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-enrolled' } });

    const mockState = {
      enrollment: {
        id: 'enrollment-1',
        user_id: 'user-enrolled',
        status: 'active',
        tier: 'growth',
        started_at: '2026-01-01T00:00:00Z',
      },
      modules: [],
      deliverables: [],
    };
    (getProgramState as jest.Mock).mockResolvedValue(mockState);

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.enrolled).toBe(true);
    expect(data.programState).toEqual(mockState);
    expect(getProgramState).toHaveBeenCalledWith('user-enrolled');
  });

  it('returns 500 when getProgramState throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (getProgramState as jest.Mock).mockRejectedValue(new Error('DB failure'));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});
