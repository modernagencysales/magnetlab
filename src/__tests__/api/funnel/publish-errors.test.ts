/**
 * @jest-environment node
 *
 * Tests for enriched publish_funnel error messages (Task 5b).
 * When publish fails due to missing/invalid content, the error must:
 *  - name exactly what field is missing
 *  - suggest the MCP tool that fixes it
 *  - include archetype_schema_hint for the affected archetype
 */

// ─── Auth mocks ──────────────────────────────────────────────────────────────

const mockSession = {
  user: { id: 'test-user-id', email: 'test@example.com', name: 'Test' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};
let currentSession: typeof mockSession | null = mockSession;

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  applyScope: jest.fn(),
}));

// ─── Service mock ─────────────────────────────────────────────────────────────

const mockPublishFunnel = jest.fn();
const mockGetStatusCode = jest.fn().mockImplementation((err: unknown) => {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
});

jest.mock('@/server/services/funnels.service', () => ({
  publishFunnel: (...args: unknown[]) => mockPublishFunnel(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

import { POST } from '@/app/api/funnel/[id]/publish/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FUNNEL_UUID_A = '550e8400-e29b-41d4-a716-446655440010';
const FUNNEL_UUID_B = '550e8400-e29b-41d4-a716-446655440011';
const FUNNEL_UUID_C = '550e8400-e29b-41d4-a716-446655440012';

function makeRequest(id: string, body: unknown) {
  const request = new Request(`http://localhost:3000/api/funnel/${id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { request, params: Promise.resolve({ id }) };
}

function makePublishContentError(missingFields: string[], archetype: string) {
  const fieldList = missingFields.join(', ');
  const err = Object.assign(
    new Error(
      `Cannot publish: ${fieldList} ${missingFields.length === 1 ? 'is' : 'are'} missing. Use update_lead_magnet to add them.`
    ),
    {
      statusCode: 400,
      missing_fields: missingFields,
      suggested_tool: 'update_lead_magnet',
      archetype_schema_hint: `Call get_archetype_schema('${archetype}') to see required fields.`,
    }
  );
  return err;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/funnel/[id]/publish — enriched content error messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSession = mockSession;
  });

  it('returns missing_fields + suggested_tool when content fields are absent', async () => {
    const err = makePublishContentError(['content.sections'], 'single-breakdown');
    mockPublishFunnel.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(400);

    const { request, params } = makeRequest(FUNNEL_UUID_A, { publish: true });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/content\.sections/);
    expect(data.error).toMatch(/update_lead_magnet/);
    expect(data.missing_fields).toEqual(['content.sections']);
    expect(data.suggested_tool).toBe('update_lead_magnet');
    expect(data.archetype_schema_hint).toMatch(/get_archetype_schema/);
    expect(data.archetype_schema_hint).toMatch(/single-breakdown/);
  });

  it('returns 200 when content is complete and publish succeeds', async () => {
    mockPublishFunnel.mockResolvedValue({
      funnel: { id: FUNNEL_UUID_B, is_published: true },
      publicUrl: 'https://magnetlab.app/p/testuser/my-funnel',
    });

    const { request, params } = makeRequest(FUNNEL_UUID_B, { publish: true });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.funnel.is_published).toBe(true);
    expect(data.missing_fields).toBeUndefined();
    expect(data.suggested_tool).toBeUndefined();
  });

  it('includes archetype name in the schema hint for any archetype', async () => {
    const err = makePublishContentError(['content.lessons'], 'mini-training');
    mockPublishFunnel.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(400);

    const { request, params } = makeRequest(FUNNEL_UUID_C, { publish: true });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.archetype_schema_hint).toContain("get_archetype_schema('mini-training')");
    expect(data.missing_fields).toEqual(['content.lessons']);
    expect(data.suggested_tool).toBe('update_lead_magnet');
  });
});

// ─── Service-level content validation (unit tests) ───────────────────────────

describe('validateContentForPublish (service unit)', () => {
  // Use jest.requireActual to bypass the jest.mock above and get the real service
  let validateContentForPublish: (
    content: unknown,
    archetype: string
  ) =>
    | { valid: true }
    | {
        valid: false;
        missing_fields: string[];
        suggested_tool: string;
        archetype_schema_hint: string;
        message: string;
      };

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = jest.requireActual<any>('@/server/services/funnels.service');
    validateContentForPublish = mod.validateContentForPublish;
  });

  it('returns valid:true for a complete single-breakdown content object', () => {
    const content = {
      headline: 'The 5-Step System That Generates 20+ Leads Per Week',
      problem_statement: 'Most agencies struggle to fill their pipeline consistently.',
      call_to_action: 'Download the full breakdown',
      sections: [
        {
          title: 'Step 1: Audit Your Pipeline',
          body: 'Start by listing every lead source you currently have. Rate each one on ROI and time investment. Most agencies discover 80% of their leads come from 2 sources.',
        },
        {
          title: 'Step 2: Build Your ICP',
          body: 'Define your ideal client profile in detail — industry, size, budget, pain point, and buying trigger. A specific ICP makes everything downstream easier.',
        },
        {
          title: 'Step 3: Create Your Magnet',
          body: 'Build one lead magnet that solves the top pain point your ICP faces. Single-topic, immediately actionable, under 15 minutes to consume.',
        },
      ],
    };

    const result = validateContentForPublish(content, 'single-breakdown');
    expect(result.valid).toBe(true);
  });

  it('returns valid:false with missing_fields when sections are absent', () => {
    const content = {
      headline: 'The 5-Step System',
      problem_statement: 'Most agencies struggle to fill their pipeline.',
      call_to_action: 'Download now',
      // sections missing
    };

    const result = validateContentForPublish(content, 'single-breakdown');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missing_fields.some((f) => f.includes('sections'))).toBe(true);
      expect(result.suggested_tool).toBe('update_lead_magnet');
      expect(result.archetype_schema_hint).toContain("get_archetype_schema('single-breakdown')");
      expect(result.message).toMatch(/update_lead_magnet/);
    }
  });

  it('returns valid:false when content is null', () => {
    const result = validateContentForPublish(null, 'single-breakdown');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missing_fields).toContain('content');
      expect(result.suggested_tool).toBe('update_lead_magnet');
    }
  });

  it('returns valid:false for unknown archetype gracefully', () => {
    const result = validateContentForPublish(
      { headline: 'Test', problem_statement: 'test', call_to_action: 'test' },
      'nonexistent-archetype'
    );
    expect(result.valid).toBe(false);
  });

  it('returns valid:true for complete mini-training content', () => {
    const content = {
      headline: 'Master LinkedIn Hooks in 3 Days',
      problem_statement:
        'Most LinkedIn posts get ignored because the first line does not hook the reader.',
      call_to_action: 'Start Day 1 now',
      lessons: [
        {
          title: 'Day 1: Your Hook Formula',
          objective: 'Write a LinkedIn hook that stops the scroll',
          content:
            'A hook is the first 1-2 lines of your post. It has one job: make the reader click "see more". The best hooks create a pattern interrupt — they say something unexpected, counterintuitive, or urgent.',
          exercise: 'Write 5 hooks for your next post using the contrarian formula.',
        },
        {
          title: 'Day 2: The Body Structure',
          objective: 'Structure your post body so readers finish it',
          content:
            'After your hook, the body must deliver on the promise. Use short paragraphs, numbered lists, and concrete examples. Each line should pull the reader to the next line.',
          exercise: 'Take your best hook from Day 1 and write a 5-point body structure for it.',
        },
      ],
    };

    const result = validateContentForPublish(content, 'mini-training');
    expect(result.valid).toBe(true);
  });
});
