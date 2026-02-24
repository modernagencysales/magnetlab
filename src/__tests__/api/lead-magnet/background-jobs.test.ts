/**
 * @jest-environment node
 */

import { createLeadMagnetSchema } from '@/lib/validations/api';

// ---------------------------------------------------------------------------
// Test: viralCheck schema defaults (fix for missing actionableUnder1h error)
// ---------------------------------------------------------------------------

describe('viralCheck schema defaults', () => {
  const basePayload = {
    title: 'Test Lead Magnet',
    archetype: 'single-breakdown' as const,
    concept: {
      title: 'Test concept',
      painSolved: 'Test pain',
      deliveryFormat: 'PDF',
    },
  };

  it('accepts concept with complete viralCheck', () => {
    const payload = {
      ...basePayload,
      concept: {
        ...basePayload.concept,
        viralCheck: {
          highValue: true,
          urgentPain: true,
          actionableUnder1h: true,
          simple: true,
          authorityBoosting: false,
        },
      },
    };

    const result = createLeadMagnetSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concept?.viralCheck?.actionableUnder1h).toBe(true);
    }
  });

  it('defaults missing viralCheck fields to false (quiz archetype bug fix)', () => {
    const payload = {
      ...basePayload,
      archetype: 'assessment' as const,
      concept: {
        ...basePayload.concept,
        viralCheck: {
          highValue: true,
          urgentPain: true,
          // actionableUnder1h is MISSING — this was the bug
          simple: true,
          authorityBoosting: true,
        },
      },
    };

    const result = createLeadMagnetSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concept?.viralCheck?.actionableUnder1h).toBe(false);
    }
  });

  it('defaults all missing viralCheck fields to false', () => {
    const payload = {
      ...basePayload,
      concept: {
        ...basePayload.concept,
        viralCheck: {
          // All fields missing — e.g. AI returned empty viralCheck
        },
      },
    };

    const result = createLeadMagnetSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concept?.viralCheck).toEqual({
        highValue: false,
        urgentPain: false,
        actionableUnder1h: false,
        simple: false,
        authorityBoosting: false,
      });
    }
  });

  it('accepts null viralCheck', () => {
    const payload = {
      ...basePayload,
      concept: {
        ...basePayload.concept,
        viralCheck: null,
      },
    };

    const result = createLeadMagnetSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('accepts missing viralCheck (undefined)', () => {
    const payload = {
      ...basePayload,
      concept: {
        ...basePayload.concept,
        // viralCheck not present at all
      },
    };

    const result = createLeadMagnetSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: API route response format (extraction and write-post return jobId)
// ---------------------------------------------------------------------------

describe('background job API route contracts', () => {
  // Mock auth, supabase, and trigger.dev
  const mockSession = { user: { id: 'test-user-id' } };
  const mockJobId = 'test-job-id-123';

  beforeEach(() => {
    jest.resetModules();

    // Mock auth
    jest.mock('@/lib/auth', () => ({
      auth: jest.fn().mockResolvedValue(mockSession),
    }));

    // Mock supabase
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: mockJobId }, error: null }),
    };
    jest.mock('@/lib/utils/supabase-server', () => ({
      createSupabaseAdminClient: jest.fn(() => mockSupabase),
    }));

    // Mock trigger.dev
    jest.mock('@trigger.dev/sdk/v3', () => ({
      tasks: {
        trigger: jest.fn().mockResolvedValue({ id: 'trigger-task-id-123' }),
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POST /api/lead-magnet/extract returns jobId for standard extraction', async () => {
    const { POST } = await import('@/app/api/lead-magnet/extract/route');

    const request = new Request('http://localhost:3000/api/lead-magnet/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archetype: 'single-breakdown',
        concept: { title: 'Test', painSolved: 'Test pain', deliveryFormat: 'PDF' },
        answers: { q1: 'Answer 1' },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('jobId');
    expect(data).toHaveProperty('status', 'pending');
  });

  it('POST /api/lead-magnet/extract returns jobId for interactive extraction', async () => {
    const { POST } = await import('@/app/api/lead-magnet/extract/route');

    const request = new Request('http://localhost:3000/api/lead-magnet/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate-interactive',
        archetype: 'single-calculator',
        concept: { title: 'ROI Calculator', painSolved: 'Unclear ROI', deliveryFormat: 'Calculator' },
        answers: { q1: 'Revenue formula' },
        businessContext: { businessDescription: 'Marketing agency', businessType: 'agency' },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('jobId');
    expect(data).toHaveProperty('status', 'pending');
  });

  it('POST /api/lead-magnet/extract stays synchronous for contextual-questions', async () => {
    // Mock the AI function for contextual questions
    jest.mock('@/lib/ai/lead-magnet-generator', () => ({
      getExtractionQuestions: jest.fn().mockReturnValue([]),
      getContextAwareExtractionQuestions: jest.fn().mockResolvedValue([
        { id: 'q1', question: 'What is your approach?', type: 'text' },
      ]),
    }));

    const { POST } = await import('@/app/api/lead-magnet/extract/route');

    const request = new Request('http://localhost:3000/api/lead-magnet/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'contextual-questions',
        archetype: 'single-breakdown',
        concept: { title: 'Test' },
        businessContext: { businessDescription: 'Test biz', businessType: 'agency' },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('questions');
    expect(data).not.toHaveProperty('jobId'); // Should NOT return jobId
  });

  it('POST /api/lead-magnet/write-post returns jobId', async () => {
    const { POST } = await import('@/app/api/lead-magnet/write-post/route');

    const request = new Request('http://localhost:3000/api/lead-magnet/write-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadMagnetTitle: 'The Revenue Calculator',
        contents: 'Calculate your potential revenue based on key metrics',
        problemSolved: 'Unclear revenue projections',
        format: 'Interactive calculator',
        credibility: '10+ years in finance',
        audience: 'B2B SaaS founders',
        audienceStyle: 'casual-direct',
        proof: 'Helped 50+ companies',
        ctaWord: 'LINK',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('jobId');
    expect(data).toHaveProperty('status', 'pending');
  });

  it('POST /api/lead-magnet/write-post rejects missing required fields', async () => {
    const { POST } = await import('@/app/api/lead-magnet/write-post/route');

    const request = new Request('http://localhost:3000/api/lead-magnet/write-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadMagnetTitle: 'Test',
        // Missing contents and problemSolved
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
