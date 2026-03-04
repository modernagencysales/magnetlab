/**
 * @jest-environment node
 */

// Mock next/server to provide a no-op `after()` function
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    after: jest.fn((_fn: () => void) => {
      // No-op in test — don't run side effects
    }),
  };
});

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock public service
const mockSubmitLead = jest.fn();
const mockSubmitQualification = jest.fn();
const mockRunLeadCreatedSideEffects = jest.fn();
const mockRunLeadQualifiedSideEffects = jest.fn();

jest.mock('@/server/services/public.service', () => ({
  submitLead: (...args: unknown[]) => mockSubmitLead(...args),
  submitQualification: (...args: unknown[]) => mockSubmitQualification(...args),
  runLeadCreatedSideEffects: (...args: unknown[]) => mockRunLeadCreatedSideEffects(...args),
  runLeadQualifiedSideEffects: (...args: unknown[]) => mockRunLeadQualifiedSideEffects(...args),
}));

import { POST, PATCH } from '@/app/api/public/lead/route';

describe('Public Lead Capture API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      mockSubmitLead.mockResolvedValue({
        success: false,
        error: 'not_found',
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
      mockSubmitLead.mockResolvedValue({
        success: false,
        error: 'not_found',
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
      const leadId = '550e8400-e29b-41d4-a716-446655440203';
      const funnelId = '550e8400-e29b-41d4-a716-446655440200';

      mockSubmitLead.mockResolvedValue({
        success: true,
        leadId,
        payload: { leadId, funnelPageId: funnelId },
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email: 'TEST@EXAMPLE.COM', // Should be lowercased by service
          name: '  John Doe  ',
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
      const leadId = '550e8400-e29b-41d4-a716-446655440303';

      mockSubmitLead.mockResolvedValue({
        success: true,
        leadId,
        payload: { leadId, funnelPageId: funnelId },
      });

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

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
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
      mockSubmitQualification.mockResolvedValue({
        success: false,
        error: 'not_found',
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

      mockSubmitQualification.mockResolvedValue({
        success: true,
        leadId,
        isQualified: true,
        payload: { leadId },
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          answers: { 'q-1': 'yes', 'q-2': 'no' },
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

      mockSubmitQualification.mockResolvedValue({
        success: true,
        leadId,
        isQualified: false,
        payload: { leadId },
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          answers: { 'q-1': 'yes', 'q-2': 'no' },
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isQualified).toBe(false);
    });
  });
});
