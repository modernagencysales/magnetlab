/**
 * @jest-environment node
 *
 * Extended lead capture tests covering database errors, rate limiting,
 * webhook integration, and edge cases not covered in lead.test.ts.
 */

import { POST, PATCH } from '@/app/api/public/lead/route';
import { resolveFullQuestionsForFunnel } from '@/lib/services/qualification';

// Track table-specific behavior
interface TableConfig {
  [tableName: string]: { data: unknown; error: unknown } | undefined;
}

interface MockChainable {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  gte: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  in: jest.Mock;
  _setTableResult: (table: string, result: { data: unknown; error: unknown }) => void;
  _setSingleResults: (table: string, results: Array<{ data: unknown; error: unknown }>) => void;
  _setRateLimitCount: (count: number) => void;
  _reset: () => void;
}

function createMockSupabase(): MockChainable {
  let tableResults: TableConfig = {};
  let currentTable = '';
  let isHeadQuery = false;
  let rateLimitCount = 0;

  const singleCallIndex: { [key: string]: number } = {};
  const singleResults: { [key: string]: Array<{ data: unknown; error: unknown }> } = {};

  const chainable: MockChainable = {
    from: jest.fn((table: string) => {
      currentTable = table;
      isHeadQuery = false;
      return chainable;
    }),
    select: jest.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => {
      isHeadQuery = opts?.head === true;
      return chainable;
    }),
    insert: jest.fn(() => chainable),
    update: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    gte: jest.fn(() => {
      if (isHeadQuery) {
        return Promise.resolve({ count: rateLimitCount, error: null });
      }
      return chainable;
    }),
    order: jest.fn(() => {
      if (currentTable === 'qualification_questions') {
        return Promise.resolve(tableResults[currentTable] || { data: [], error: null });
      }
      return chainable;
    }),
    single: jest.fn(() => {
      const table = currentTable;
      if (singleResults[table] && singleResults[table].length > 0) {
        const idx = singleCallIndex[table] || 0;
        singleCallIndex[table] = idx + 1;
        return Promise.resolve(singleResults[table][idx] || { data: null, error: null });
      }
      return Promise.resolve(tableResults[table] || { data: null, error: null });
    }),
    in: jest.fn(() => chainable),
    _setTableResult: (table: string, result: { data: unknown; error: unknown }) => {
      tableResults[table] = result;
    },
    _setSingleResults: (table: string, results: Array<{ data: unknown; error: unknown }>) => {
      singleResults[table] = results;
      singleCallIndex[table] = 0;
    },
    _setRateLimitCount: (count: number) => {
      rateLimitCount = count;
    },
    _reset: () => {
      tableResults = {};
      isHeadQuery = false;
      rateLimitCount = 0;
      Object.keys(singleCallIndex).forEach(k => delete singleCallIndex[k]);
      Object.keys(singleResults).forEach(k => delete singleResults[k]);
    },
  };

  return chainable;
}

const mockSupabaseClient = createMockSupabase();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/webhooks/sender', () => ({
  deliverWebhook: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/services/email-sequence-trigger', () => ({
  triggerEmailSequenceIfActive: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/webhooks/gtm-system', () => ({
  fireGtmLeadCreatedWebhook: jest.fn(() => Promise.resolve()),
  fireGtmLeadQualifiedWebhook: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/webhooks/conductor', () => ({
  deliverConductorWebhook: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/services/qualification', () => ({
  resolveFullQuestionsForFunnel: jest.fn(() => Promise.resolve({ questions: [] })),
}));

jest.mock('@/lib/services/tracking-pixels', () => ({
  fireTrackingPixelLeadEvent: jest.fn(() => Promise.resolve()),
  fireTrackingPixelQualifiedEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/api/errors', () => ({
  logApiError: jest.fn(),
}));

jest.mock('@/lib/posthog', () => ({
  getPostHogServerClient: jest.fn(() => ({
    capture: jest.fn(),
  })),
}));

describe('Lead Capture API — Extended Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
  });

  describe('POST /api/public/lead — validation', () => {
    it('should return 400 when email is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when funnel_page_id is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/public/lead — creation', () => {
    const funnelId = '550e8400-e29b-41d4-a716-446655440200';
    const userId = '550e8400-e29b-41d4-a716-446655440201';
    const leadMagnetId = '550e8400-e29b-41d4-a716-446655440202';
    const leadId = '550e8400-e29b-41d4-a716-446655440203';

    function setupSuccessMocks() {
      mockSupabaseClient._setSingleResults('funnel_pages', [
        {
          data: {
            id: funnelId,
            user_id: userId,
            lead_magnet_id: leadMagnetId,
            slug: 'test-funnel',
            is_published: true,
          },
          error: null,
        },
      ]);
      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: {
            id: leadId,
            email: 'test@example.com',
            name: null,
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            created_at: '2026-02-14T00:00:00Z',
          },
          error: null,
        },
      ]);
      mockSupabaseClient._setSingleResults('lead_magnets', [
        { data: { title: 'Test Lead Magnet', external_url: null, polished_content: null, extracted_content: null }, error: null },
      ]);
      mockSupabaseClient._setSingleResults('users', [
        { data: { username: 'testuser' }, error: null },
      ]);
    }

    it('should create a funnel_lead with correct fields and return 201', async () => {
      setupSuccessMocks();

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email: 'test@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.leadId).toBe(leadId);
      expect(data.success).toBe(true);

      // Verify insert was called on funnel_leads
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funnel_leads');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should return 201 with UTM parameters passed through', async () => {
      setupSuccessMocks();

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email: 'utm-test@example.com',
          name: 'UTM Test',
          utmSource: 'linkedin',
          utmMedium: 'social',
          utmCampaign: 'spring2026',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('should return 500 when database insert fails', async () => {
      mockSupabaseClient._setSingleResults('funnel_pages', [
        {
          data: {
            id: funnelId,
            user_id: userId,
            lead_magnet_id: leadMagnetId,
            slug: 'test-funnel',
            is_published: true,
          },
          error: null,
        },
      ]);
      // Insert fails
      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: null,
          error: { message: 'unique_violation', code: '23505' },
        },
      ]);

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email: 'dupe@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to capture lead');
      expect(data.code).toBe('DATABASE_ERROR');
    });

    it('should return 429 when rate limited', async () => {
      mockSupabaseClient._setRateLimitCount(10); // Well above the limit of 5

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-real-ip': '1.2.3.4',
        },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email: 'ratelimited@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe('RATE_LIMITED');
    });
  });

  describe('PATCH /api/public/lead — qualification', () => {
    it('should handle qualification answers correctly with empty questions', async () => {
      const leadId = '550e8400-e29b-41d4-a716-446655440500';
      const funnelPageId = '550e8400-e29b-41d4-a716-446655440501';
      const userId = '550e8400-e29b-41d4-a716-446655440502';

      // resolveFullQuestionsForFunnel returns empty questions
      (resolveFullQuestionsForFunnel as jest.Mock).mockResolvedValue({ questions: [] });

      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: {
            id: leadId,
            funnel_page_id: funnelPageId,
            user_id: userId,
            email: 'qual@example.com',
            name: 'Qual Test',
          },
          error: null,
        },
        {
          data: {
            id: leadId,
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            created_at: '2026-02-14T00:00:00Z',
          },
          error: null,
        },
      ]);

      mockSupabaseClient._setSingleResults('funnel_pages', [
        { data: { qualification_form_id: null }, error: null },
        { data: { slug: 'test', lead_magnets: { title: 'Test' } }, error: null },
      ]);

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          answers: {},
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isQualified).toBe(true); // No qualifying questions means qualified by default
      expect(data.success).toBe(true);
    });
  });
});
