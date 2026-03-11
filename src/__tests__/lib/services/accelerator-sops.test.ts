/**
 * @jest-environment node
 */

jest.mock('@/lib/utils/supabase-server');
jest.mock('@/lib/utils/logger');

import { getSopsByModule } from '@/lib/services/accelerator-program';
import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';

const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

(getSupabaseAdminClient as jest.MockedFunction<typeof getSupabaseAdminClient>).mockReturnValue({
  from: mockFrom,
} as unknown as ReturnType<typeof getSupabaseAdminClient>);

describe('getSopsByModule', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries program_sops table with correct module_id', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await getSopsByModule('m1');

    expect(mockFrom).toHaveBeenCalledWith('program_sops');
    expect(mockEq).toHaveBeenCalledWith('module_id', 'm1');
    expect(mockOrder).toHaveBeenCalledWith('sop_number');
  });

  it('returns SOP data with expected shape', async () => {
    const mockSops = [
      {
        id: 'sop-1',
        module_id: 'm1',
        sop_number: '1-1',
        title: 'Ideate a Lead Magnet',
        content: '## Steps\n1. Open Magnet Lab...',
        quality_bars: [{ check: 'Lead magnet addresses ICP #1 problem', severity: 'critical' }],
        deliverables: [{ type: 'lead_magnet', description: 'Lead magnet concept' }],
        tools_used: ['magnetlab_ideator'],
        dependencies: ['0-1'],
        version: 1,
      },
    ];
    mockOrder.mockResolvedValue({ data: mockSops, error: null });

    const result = await getSopsByModule('m1');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Ideate a Lead Magnet');
    expect(result[0].quality_bars).toHaveLength(1);
    expect(result[0].tools_used).toContain('magnetlab_ideator');
  });

  it('returns empty array on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } });

    const result = await getSopsByModule('m1');

    expect(result).toEqual([]);
  });
});
