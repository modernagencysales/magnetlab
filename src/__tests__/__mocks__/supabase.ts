// Mock Supabase client for testing

interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  single: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  limit: jest.Mock;
  rpc: jest.Mock;
}

export const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  eq: jest.fn(),
  neq: jest.fn(),
  single: jest.fn(),
  order: jest.fn(),
  range: jest.fn(),
  limit: jest.fn(),
  rpc: jest.fn(),
};

// Setup chain methods to return mockSupabaseClient
mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.delete.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.neq.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.single.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.range.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.limit.mockReturnValue(mockSupabaseClient);

export const createMockSupabaseResponse = <T>(data: T | null, error: { message: string; code: string } | null = null) => ({
  data,
  error,
  count: Array.isArray(data) ? data.length : data ? 1 : 0,
});

export const resetSupabaseMocks = () => {
  Object.values(mockSupabaseClient).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      (mock as jest.Mock).mockReset();
      // Re-setup chain methods to return mockSupabaseClient
      (mock as jest.Mock).mockReturnValue(mockSupabaseClient);
    }
  });
};

// Mock the server client creation
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));
