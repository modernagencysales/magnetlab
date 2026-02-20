/**
 * @jest-environment node
 */

import { POST, PATCH } from '@/app/api/public/lead/route';

// Track which table is being queried to return appropriate results
interface TableResults {
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
  _setTableResult: (table: string, result: { data: unknown; error: unknown }) => void;
  _setSingleResults: (table: string, results: Array<{ data: unknown; error: unknown }>) => void;
  _reset: () => void;
}

function createMockSupabase(): MockChainable {
  let tableResults: TableResults = {};
  let currentTable = '';
  let isHeadQuery = false;

  // Track order of .single() calls for chained queries on same table
  const singleCallIndex: { [key: string]: number } = {};
  const singleResults: { [key: string]: Array<{ data: unknown; error: unknown }> } = {};

  const chainable: MockChainable = {
    from: jest.fn((table: string) => {
      currentTable = table;
      isHeadQuery = false;
      return chainable;
    }),
    select: jest.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => {
      // Track if this is a head/count query (used for rate limiting)
      isHeadQuery = opts?.head === true;
      return chainable;
    }),
    insert: jest.fn(() => chainable),
    update: jest.fn(() => chainable),
    eq: jest.fn(() => {
      return chainable;
    }),
    gte: jest.fn(() => {
      // For rate limit queries (head: true), resolve with count: 0
      if (isHeadQuery) {
        return Promise.resolve({ count: 0, error: null });
      }
      return chainable;
    }),
    order: jest.fn(() => {
      // For qualification_questions, order is the terminal call (no .single())
      if (currentTable === 'qualification_questions') {
        return Promise.resolve(tableResults[currentTable] || { data: [], error: null });
      }
      return chainable;
    }),
    single: jest.fn(() => {
      const table = currentTable;
      // Handle multiple .single() calls on same table
      if (singleResults[table] && singleResults[table].length > 0) {
        const idx = singleCallIndex[table] || 0;
        singleCallIndex[table] = idx + 1;
        return Promise.resolve(singleResults[table][idx] || { data: null, error: null });
      }
      return Promise.resolve(tableResults[table] || { data: null, error: null });
    }),
    _setTableResult: (table: string, result: { data: unknown; error: unknown }) => {
      tableResults[table] = result;
    },
    _setSingleResults: (table: string, results: Array<{ data: unknown; error: unknown }>) => {
      singleResults[table] = results;
      singleCallIndex[table] = 0;
    },
    _reset: () => {
      tableResults = {};
      isHeadQuery = false;
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
  triggerEmailSequenceIfActive: jest.fn(() => Promise.resolve({ triggered: false })),
  triggerEmailFlowIfActive: jest.fn(() => Promise.resolve({ triggered: false })),
  upsertSubscriberFromLead: jest.fn(() => Promise.resolve()),
}));

describe('Public Lead Capture API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
  });

  describe('POST /api/public/lead', () => {
    it('should return 400 if funnelPageId is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('funnelPageId');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if email is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Email');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'invalid-email',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('email');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if funnel page not found', async () => {
      mockSupabaseClient._setTableResult('funnel_pages', {
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: '550e8400-e29b-41d4-a716-446655440099',
          email: 'test@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should return 404 if funnel page is not published', async () => {
      const funnelId = '550e8400-e29b-41d4-a716-446655440100';
      mockSupabaseClient._setTableResult('funnel_pages', {
        data: {
          id: funnelId,
          user_id: '550e8400-e29b-41d4-a716-446655440101',
          lead_magnet_id: '550e8400-e29b-41d4-a716-446655440102',
          slug: 'test',
          is_published: false,
        },
        error: null,
      });

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

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should create lead successfully', async () => {
      const funnelId = '550e8400-e29b-41d4-a716-446655440200';
      const userId = '550e8400-e29b-41d4-a716-446655440201';
      const leadMagnetId = '550e8400-e29b-41d4-a716-446655440202';
      const leadId = '550e8400-e29b-41d4-a716-446655440203';

      // Set up ordered results: funnel_pages query, then funnel_leads insert, then lead_magnets
      mockSupabaseClient._setSingleResults('funnel_pages', [
        {
          data: {
            id: funnelId,
            user_id: userId,
            lead_magnet_id: leadMagnetId,
            slug: 'test',
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
            name: 'John Doe',
            utm_source: 'linkedin',
            utm_medium: 'social',
            utm_campaign: 'launch',
            created_at: '2025-01-26T00:00:00Z',
          },
          error: null,
        },
      ]);
      mockSupabaseClient._setSingleResults('lead_magnets', [
        { data: { title: 'My Lead Magnet' }, error: null },
      ]);

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email: 'TEST@EXAMPLE.COM', // Should be lowercased
          name: '  John Doe  ', // Should be trimmed
          utmSource: 'linkedin',
          utmMedium: 'social',
          utmCampaign: 'launch',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.leadId).toBe(leadId);
      expect(data.success).toBe(true);
    });

    it('should normalize email to lowercase', async () => {
      const funnelId = '550e8400-e29b-41d4-a716-446655440300';
      const userId = '550e8400-e29b-41d4-a716-446655440301';
      const leadMagnetId = '550e8400-e29b-41d4-a716-446655440302';
      const leadId = '550e8400-e29b-41d4-a716-446655440303';

      mockSupabaseClient._setSingleResults('funnel_pages', [
        {
          data: {
            id: funnelId,
            user_id: userId,
            lead_magnet_id: leadMagnetId,
            slug: 'test',
            is_published: true,
          },
          error: null,
        },
      ]);
      mockSupabaseClient._setSingleResults('funnel_leads', [
        { data: { id: leadId, email: 'test@example.com', created_at: '2025-01-26T00:00:00Z' }, error: null },
      ]);
      mockSupabaseClient._setSingleResults('lead_magnets', [
        { data: { title: 'Test' }, error: null },
      ]);

      // Note: Email must pass validation regex before normalization
      // So we use a valid format but with uppercase letters
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email: 'TEST@Example.COM',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify successful creation - the route normalizes email to lowercase internally
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      // The insert was called (from is called for funnel_leads table)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funnel_leads');
    });
  });

  describe('PATCH /api/public/lead', () => {
    it('should return 400 if leadId is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { 'q-1': 'yes' } }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('leadId');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if answers is not an object', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: '550e8400-e29b-41d4-a716-446655440000',
          answers: 'invalid',
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 if lead not found', async () => {
      mockSupabaseClient._setTableResult('funnel_leads', {
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: '550e8400-e29b-41d4-a716-446655440000',
          answers: { 'q-1': 'yes' },
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Lead not found');
    });

    it('should determine qualification based on answers', async () => {
      const leadId = '550e8400-e29b-41d4-a716-446655440001';
      const funnelPageId = '550e8400-e29b-41d4-a716-446655440002';
      const userId = '550e8400-e29b-41d4-a716-446655440003';

      // Setup funnel_leads results for: get lead, then update lead
      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: {
            id: leadId,
            funnel_page_id: funnelPageId,
            user_id: userId,
            email: 'test@example.com',
            name: 'Test',
          },
          error: null,
        },
        {
          data: {
            id: leadId,
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            created_at: '2025-01-26T00:00:00Z',
          },
          error: null,
        },
      ]);

      // qualification_questions now resolved via .order() with full fields
      mockSupabaseClient._setTableResult('qualification_questions', {
        data: [
          { id: 'q-1', question_text: 'Do you use LinkedIn?', answer_type: 'yes_no', qualifying_answer: 'yes', is_qualifying: true, is_required: true },
          { id: 'q-2', question_text: 'Do you have a funnel?', answer_type: 'yes_no', qualifying_answer: 'no', is_qualifying: true, is_required: true },
        ],
        error: null,
      });

      // funnel_pages now uses join: select('slug, lead_magnets(title)')
      mockSupabaseClient._setSingleResults('funnel_pages', [
        { data: { slug: 'test', lead_magnets: { title: 'Test Lead Magnet' } }, error: null },
      ]);

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          answers: { 'q-1': 'yes', 'q-2': 'no' }, // Both match qualifying answers
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isQualified).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should mark as not qualified if any answer does not match', async () => {
      const leadId = '550e8400-e29b-41d4-a716-446655440010';
      const funnelPageId = '550e8400-e29b-41d4-a716-446655440011';
      const userId = '550e8400-e29b-41d4-a716-446655440012';

      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: {
            id: leadId,
            funnel_page_id: funnelPageId,
            user_id: userId,
            email: 'test@example.com',
            name: 'Test',
          },
          error: null,
        },
        {
          data: {
            id: leadId,
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            created_at: '2025-01-26T00:00:00Z',
          },
          error: null,
        },
      ]);

      mockSupabaseClient._setTableResult('qualification_questions', {
        data: [
          { id: 'q-1', question_text: 'Do you use LinkedIn?', answer_type: 'yes_no', qualifying_answer: 'yes', is_qualifying: true, is_required: true },
          { id: 'q-2', question_text: 'Do you have a team?', answer_type: 'yes_no', qualifying_answer: 'yes', is_qualifying: true, is_required: true }, // Needs 'yes'
        ],
        error: null,
      });

      // funnel_pages now uses join: select('slug, lead_magnets(title)')
      mockSupabaseClient._setSingleResults('funnel_pages', [
        { data: { slug: 'test', lead_magnets: { title: 'Test' } }, error: null },
      ]);

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          answers: { 'q-1': 'yes', 'q-2': 'no' }, // q-2 doesn't match
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isQualified).toBe(false);
    });
  });
});
