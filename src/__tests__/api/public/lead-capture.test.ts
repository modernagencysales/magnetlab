/**
 * @jest-environment node
 *
 * Extended lead capture tests covering database errors, rate limiting,
 * webhook integration, and edge cases not covered in lead.test.ts.
 */

// Mock the service module — the route handler delegates all business logic here
const mockSubmitLead = jest.fn();
const mockRunLeadCreatedSideEffects = jest.fn();
const mockSubmitQualification = jest.fn();
const mockRunLeadQualifiedSideEffects = jest.fn();

jest.mock('@/server/services/public.service', () => ({
  submitLead: (...args: unknown[]) => mockSubmitLead(...args),
  runLeadCreatedSideEffects: (...args: unknown[]) => mockRunLeadCreatedSideEffects(...args),
  submitQualification: (...args: unknown[]) => mockSubmitQualification(...args),
  runLeadQualifiedSideEffects: (...args: unknown[]) => mockRunLeadQualifiedSideEffects(...args),
}));

jest.mock('@/lib/api/errors', () => ({
  logApiError: jest.fn(),
}));

// Mock next/server after() — it's a fire-and-forget side-effect runner
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    after: jest.fn((fn: () => Promise<void>) => {
      // Execute immediately in tests to ensure side effects run
      fn().catch(() => {});
    }),
  };
});

import { POST, PATCH } from '@/app/api/public/lead/route';

describe('Lead Capture API — Extended Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const leadId = '550e8400-e29b-41d4-a716-446655440203';

    it('should create a funnel_lead with correct fields and return 201', async () => {
      mockSubmitLead.mockResolvedValue({
        success: true,
        leadId,
        payload: {
          lead: { id: leadId, email: 'test@example.com', name: null },
          funnel: { id: funnelId, user_id: 'user-1', slug: 'test-funnel' },
        },
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

      expect(response.status).toBe(201);
      expect(data.leadId).toBe(leadId);
      expect(data.success).toBe(true);

      // Verify submitLead was called with the right positional args
      expect(mockSubmitLead).toHaveBeenCalledWith(
        funnelId,
        'test@example.com',
        null, // name
        'unknown', // ip (no x-real-ip header in test request)
        null, // userAgent (Request() has no default user-agent)
        null, // utmSource
        null, // utmMedium
        null, // utmCampaign
        null, // linkedinUrl
        null, // fbc
        null, // fbp
      );
    });

    it('should return 201 with UTM parameters passed through', async () => {
      mockSubmitLead.mockResolvedValue({
        success: true,
        leadId,
        payload: {
          lead: { id: leadId, email: 'utm-test@example.com', name: 'UTM Test' },
          funnel: { id: funnelId, user_id: 'user-1', slug: 'test-funnel' },
        },
      });

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
      mockSubmitLead.mockResolvedValue({
        success: false,
        error: 'database',
      });

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
      mockSubmitLead.mockResolvedValue({
        success: false,
        error: 'rate_limited',
      });

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

      mockSubmitQualification.mockResolvedValue({
        success: true,
        leadId,
        isQualified: true,
        payload: {
          lead: { id: leadId, email: 'qual@example.com', name: 'Qual Test' },
          funnel: { id: 'funnel-1', user_id: 'user-1', slug: 'test' },
        },
      });

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
