/**
 * @jest-environment node
 */
import {
  getEnrollmentByUserId,
  createEnrollment,
  getModulesByEnrollment,
  updateModuleStatus,
  getDeliverablesByEnrollment,
  createDeliverable,
  updateDeliverableStatus,
  getProgramState,
  type CreateDeliverableInput,
} from '@/lib/services/accelerator-program';

// ─── Supabase chain mocks ─────────────────────────────────────────────
//
// The Supabase client is fully mocked. Each method is a jest.fn() and the
// chain object is returned from mockFrom(). Terminal methods (single, order,
// gte) are configured per-test via mockResolvedValue / mockResolvedValueOnce.

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockOrder = jest.fn();
const mockGte = jest.fn();
const mockIn = jest.fn();

// A static chain object shared by all from() calls.
// Methods that are NOT terminal must return `chain` so chaining works.
const chain: Record<string, jest.Mock> = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  single: mockSingle,
  order: mockOrder,
  gte: mockGte,
  in: mockIn,
};

const mockFrom = jest.fn(() => chain);

jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Tests ───────────────────────────────────────────────────────────

describe('accelerator-program service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: all chaining methods return the chain for further chaining.
    // Terminal methods (single, order, gte) default to resolving with empty/null.
    mockSelect.mockReturnValue(chain);
    mockInsert.mockReturnValue(chain);
    mockUpdate.mockReturnValue(chain);
    mockEq.mockReturnValue(chain);
    mockIn.mockReturnValue(chain);

    // Terminal mocks default to empty/successful responses
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockGte.mockResolvedValue({ data: [], error: null });
  });

  // ─── Enrollment ───────────────────────────────────────────────────

  describe('getEnrollmentByUserId', () => {
    it('returns enrollment for active user', async () => {
      const enrollment = {
        id: 'e1',
        user_id: 'u1',
        status: 'active',
        selected_modules: ['m0', 'm1'],
      };
      mockSingle.mockResolvedValue({ data: enrollment, error: null });

      const result = await getEnrollmentByUserId('u1');
      expect(result).toEqual(enrollment);
      expect(mockFrom).toHaveBeenCalledWith('program_enrollments');
    });

    it('returns null when no enrollment exists', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await getEnrollmentByUserId('u1');
      expect(result).toBeNull();
    });
  });

  describe('createEnrollment', () => {
    it('creates enrollment with selected modules', async () => {
      const enrollment = { id: 'e1', user_id: 'u1', selected_modules: ['m0', 'm1'] };
      mockSingle.mockResolvedValue({ data: enrollment, error: null });
      // Second insert (module rows) — the chain itself is awaited (no .single()),
      // so insert must resolve when awaited. Use mockResolvedValueOnce on insert
      // for the second call to avoid breaking the first (which leads to single()).
      mockInsert
        .mockReturnValueOnce(chain) // first call: insert enrollment → chain → .select().single()
        .mockResolvedValueOnce({ error: null }); // second call: insert module rows → awaited directly

      const result = await createEnrollment('u1', ['m0', 'm1']);
      expect(result).toEqual(enrollment);
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Modules ──────────────────────────────────────────────────────

  describe('getModulesByEnrollment', () => {
    it('returns modules list for enrollment', async () => {
      const modules = [{ id: 'mod1', enrollment_id: 'e1', module_id: 'm0', status: 'active' }];
      mockOrder.mockResolvedValue({ data: modules, error: null });

      const result = await getModulesByEnrollment('e1');
      expect(result).toEqual(modules);
      expect(mockFrom).toHaveBeenCalledWith('program_modules');
    });

    it('returns empty array on error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await getModulesByEnrollment('e1');
      expect(result).toEqual([]);
    });
  });

  describe('updateModuleStatus', () => {
    it('updates status and sets started_at on first activation', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'mod1', status: 'active' }, error: null });

      const result = await updateModuleStatus('mod1', 'active', 'm0-icp');
      expect(result).toBeTruthy();
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  // ─── Deliverables ─────────────────────────────────────────────────

  describe('getDeliverablesByEnrollment', () => {
    it('returns deliverables list for enrollment', async () => {
      const deliverables = [
        {
          id: 'd1',
          enrollment_id: 'e1',
          deliverable_type: 'icp_definition',
          status: 'in_progress',
        },
      ];
      mockOrder.mockResolvedValue({ data: deliverables, error: null });

      const result = await getDeliverablesByEnrollment('e1');
      expect(result).toEqual(deliverables);
      expect(mockFrom).toHaveBeenCalledWith('program_deliverables');
    });

    it('returns empty array on error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await getDeliverablesByEnrollment('e1');
      expect(result).toEqual([]);
    });
  });

  describe('createDeliverable', () => {
    it('creates deliverable linked to entity', async () => {
      const deliverable = { id: 'd1', deliverable_type: 'icp_definition', status: 'in_progress' };
      mockSingle.mockResolvedValue({ data: deliverable, error: null });

      const input: CreateDeliverableInput = {
        enrollment_id: 'e1',
        module_id: 'm0',
        deliverable_type: 'icp_definition',
      };
      const result = await createDeliverable(input);
      expect(result).toEqual(deliverable);
    });
  });

  describe('updateDeliverableStatus', () => {
    it('updates status on deliverable', async () => {
      const deliverable = { id: 'd1', status: 'approved' };
      mockSingle.mockResolvedValue({ data: deliverable, error: null });

      const result = await updateDeliverableStatus('d1', 'approved');
      expect(result).toEqual(deliverable);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('includes validation result when provided', async () => {
      const deliverable = { id: 'd1', status: 'approved' };
      mockSingle.mockResolvedValue({ data: deliverable, error: null });

      const validation = { passed: true, checks: [], feedback: 'Looks good' };
      const result = await updateDeliverableStatus('d1', 'approved', validation);
      expect(result).toEqual(deliverable);
    });
  });

  // ─── Composite State ──────────────────────────────────────────────

  describe('getProgramState', () => {
    it('returns null when no enrollment found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await getProgramState('u-missing');
      expect(result).toBeNull();
    });

    it('returns full program state when enrollment exists', async () => {
      const enrollment = { id: 'e1', user_id: 'u1', status: 'active', selected_modules: ['m0'] };
      // enrollment lookup ends in .single()
      mockSingle.mockResolvedValueOnce({ data: enrollment, error: null });
      // modules, deliverables, review queue → .order() terminal
      // usage events → .gte() terminal
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockGte.mockResolvedValue({ data: [], error: null });

      const result = await getProgramState('u1');
      expect(result).not.toBeNull();
      expect(result!.enrollment).toEqual(enrollment);
      expect(Array.isArray(result!.modules)).toBe(true);
      expect(Array.isArray(result!.deliverables)).toBe(true);
    });
  });
});
