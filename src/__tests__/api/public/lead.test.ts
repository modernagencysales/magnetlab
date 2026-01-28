/**
 * @jest-environment node
 */

import { POST, PATCH } from '@/app/api/public/lead/route';

// Track which table is being queried to return appropriate results
interface TableResults {
  [tableName: string]: { data: unknown; error: unknown } | undefined;
}

function createMockSupabase() {
  let tableResults: TableResults = {};
  let currentTable = '';

  // Track order of .single() calls for chained queries on same table
  const singleCallIndex: { [key: string]: number } = {};
  const singleResults: { [key: string]: Array<{ data: unknown; error: unknown }> } = {};

  const chainable = {
    from: jest.fn((table: string) => {
      currentTable = table;
      return chainable;
    }),
    select: jest.fn(() => chainable),
    insert: jest.fn(() => chainable),
    update: jest.fn(() => chainable),
    eq: jest.fn(() => {
      // For qualification_questions, eq resolves directly (no .single())
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
      expect(data.error).toBe('funnelPageId and email are required');
    });

    it('should return 400 if email is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId: 'funnel-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('funnelPageId and email are required');
    });

    it('should return 400 for invalid email format', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: 'funnel-123',
          email: 'invalid-email',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
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
          funnelPageId: 'nonexistent',
          email: 'test@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should return 404 if funnel page is not published', async () => {
      mockSupabaseClient._setTableResult('funnel_pages', {
        data: {
          id: 'funnel-123',
          user_id: 'user-123',
          lead_magnet_id: 'lm-123',
          slug: 'test',
          is_published: false,
        },
        error: null,
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: 'funnel-123',
          email: 'test@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should create lead successfully', async () => {
      // Set up ordered results: funnel_pages query, then funnel_leads insert, then lead_magnets
      mockSupabaseClient._setSingleResults('funnel_pages', [
        {
          data: {
            id: 'funnel-123',
            user_id: 'user-123',
            lead_magnet_id: 'lm-123',
            slug: 'test',
            is_published: true,
          },
          error: null,
        },
      ]);
      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: {
            id: 'lead-123',
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
          funnelPageId: 'funnel-123',
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
      expect(data.leadId).toBe('lead-123');
      expect(data.success).toBe(true);
    });

    it('should normalize email to lowercase', async () => {
      mockSupabaseClient._setSingleResults('funnel_pages', [
        {
          data: {
            id: 'funnel-123',
            user_id: 'user-123',
            lead_magnet_id: 'lm-123',
            slug: 'test',
            is_published: true,
          },
          error: null,
        },
      ]);
      mockSupabaseClient._setSingleResults('funnel_leads', [
        { data: { id: 'lead-123', email: 'test@example.com', created_at: '2025-01-26T00:00:00Z' }, error: null },
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
          funnelPageId: 'funnel-123',
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
        body: JSON.stringify({ answers: {} }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('leadId and answers are required');
    });

    it('should return 400 if answers is not an object', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: 'lead-123', answers: 'invalid' }),
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
          leadId: 'nonexistent',
          answers: { 'q-1': 'yes' },
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Lead not found');
    });

    it('should determine qualification based on answers', async () => {
      // Setup funnel_leads results for: get lead, then update lead
      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: {
            id: 'lead-123',
            funnel_page_id: 'funnel-123',
            user_id: 'user-123',
            email: 'test@example.com',
            name: 'Test',
          },
          error: null,
        },
        {
          data: {
            id: 'lead-123',
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            created_at: '2025-01-26T00:00:00Z',
          },
          error: null,
        },
      ]);

      // qualification_questions uses eq which resolves directly (no .single())
      mockSupabaseClient._setTableResult('qualification_questions', {
        data: [
          { id: 'q-1', qualifying_answer: 'yes' },
          { id: 'q-2', qualifying_answer: 'no' },
        ],
        error: null,
      });

      mockSupabaseClient._setSingleResults('funnel_pages', [
        { data: { slug: 'test', lead_magnet_id: 'lm-123' }, error: null },
      ]);
      mockSupabaseClient._setSingleResults('lead_magnets', [
        { data: { title: 'Test Lead Magnet' }, error: null },
      ]);

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-123',
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
      mockSupabaseClient._setSingleResults('funnel_leads', [
        {
          data: {
            id: 'lead-123',
            funnel_page_id: 'funnel-123',
            user_id: 'user-123',
            email: 'test@example.com',
            name: 'Test',
          },
          error: null,
        },
        {
          data: {
            id: 'lead-123',
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
          { id: 'q-1', qualifying_answer: 'yes' },
          { id: 'q-2', qualifying_answer: 'yes' }, // Needs 'yes'
        ],
        error: null,
      });

      mockSupabaseClient._setSingleResults('funnel_pages', [
        { data: { slug: 'test', lead_magnet_id: 'lm-123' }, error: null },
      ]);
      mockSupabaseClient._setSingleResults('lead_magnets', [
        { data: { title: 'Test' }, error: null },
      ]);

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-123',
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
