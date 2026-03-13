/**
 * @jest-environment node
 *
 * Tests for POST /api/lead-magnet/launch — compound action.
 * Validates: request schema, archetype content validation, rollback on failure,
 * email sequence creation, and happy path.
 */

import { POST } from '@/app/api/lead-magnet/launch/route';

// ─── Mocks ─────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn().mockResolvedValue({ type: 'user', userId: 'user-1' }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

const mockCreateLeadMagnet = jest.fn();
const mockUpdateLeadMagnetContent = jest.fn();
const mockDeleteLeadMagnet = jest.fn();
jest.mock('@/server/services/lead-magnets.service', () => ({
  createLeadMagnet: (...args: unknown[]) => mockCreateLeadMagnet(...args),
  updateLeadMagnetContent: (...args: unknown[]) => mockUpdateLeadMagnetContent(...args),
  deleteLeadMagnet: (...args: unknown[]) => mockDeleteLeadMagnet(...args),
  getStatusCode: (err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err)
      return (err as { statusCode: number }).statusCode;
    return 500;
  },
}));

const mockCreateFunnel = jest.fn();
const mockPublishFunnel = jest.fn();
const mockDeleteFunnel = jest.fn();
jest.mock('@/server/services/funnels.service', () => ({
  createFunnel: (...args: unknown[]) => mockCreateFunnel(...args),
  publishFunnel: (...args: unknown[]) => mockPublishFunnel(...args),
  deleteFunnel: (...args: unknown[]) => mockDeleteFunnel(...args),
  validateContentForPublish: jest.fn().mockReturnValue({ valid: true }),
  getStatusCode: (err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err)
      return (err as { statusCode: number }).statusCode;
    return 500;
  },
}));

const mockEmailGenerate = jest.fn();
const mockEmailUpdate = jest.fn();
const mockEmailActivate = jest.fn();
jest.mock('@/server/services/email-sequence.service', () => ({
  generate: (...args: unknown[]) => mockEmailGenerate(...args),
  update: (...args: unknown[]) => mockEmailUpdate(...args),
  activate: (...args: unknown[]) => mockEmailActivate(...args),
}));

import { auth } from '@/lib/auth';
import { validateContentForPublish } from '@/server/services/funnels.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/lead-magnet/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_CONTENT = {
  headline: 'The 5-Step Lead Gen System That Gets Results',
  problem_statement:
    'Most agencies waste time on cold outreach that never converts into real meetings.',
  call_to_action: 'Download the free guide now',
  sections: [
    {
      title: 'Step 1: Audit Pipeline',
      body: 'Start by auditing your current pipeline. Look at every stage and identify where deals stall. This reveals the real bottleneck in your sales process.',
    },
    {
      title: 'Step 2: Fix Messaging',
      body: 'Once you know the bottleneck, rewrite your messaging to address the specific objection at that stage. Test variations weekly until conversion improves.',
    },
    {
      title: 'Step 3: Automate Follow-Up',
      body: 'Set up automated follow-up sequences that trigger based on prospect behavior. This ensures no lead falls through the cracks in your pipeline.',
    },
  ],
};

const VALID_BODY = {
  title: '5-Step Lead Gen System',
  archetype: 'single-breakdown',
  content: VALID_CONTENT,
  slug: '5-step-lead-gen',
  funnel_theme: 'modern',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/lead-magnet/launch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mockCreateLeadMagnet.mockResolvedValue({ id: 'lm-1' });
    mockUpdateLeadMagnetContent.mockResolvedValue({ id: 'lm-1', content: VALID_CONTENT });
    mockCreateFunnel.mockResolvedValue({ id: 'funnel-1' });
    mockPublishFunnel.mockResolvedValue({
      funnel: { id: 'funnel-1' },
      publicUrl: '/p/testuser/5-step-lead-gen',
    });
    (validateContentForPublish as jest.Mock).mockReturnValue({ valid: true });
  });

  // ─── Auth ───────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValueOnce(null);

      const response = await POST(buildRequest(VALID_BODY));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  // ─── Happy path ─────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('creates lead magnet + funnel + publishes, returns IDs and URL', async () => {
      const response = await POST(buildRequest(VALID_BODY));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.lead_magnet_id).toBe('lm-1');
      expect(body.funnel_id).toBe('funnel-1');
      expect(body.public_url).toBe('/p/testuser/5-step-lead-gen');
      expect(body.email_sequence_id).toBeNull();
    });

    it('passes correct arguments to createLeadMagnet', async () => {
      await POST(buildRequest(VALID_BODY));

      expect(mockCreateLeadMagnet).toHaveBeenCalledWith(
        { type: 'user', userId: 'user-1' },
        { title: '5-Step Lead Gen System', archetype: 'single-breakdown' }
      );
    });

    it('passes content to updateLeadMagnetContent after creation', async () => {
      await POST(buildRequest(VALID_BODY));

      expect(mockUpdateLeadMagnetContent).toHaveBeenCalledWith(
        { type: 'user', userId: 'user-1' },
        'lm-1',
        VALID_CONTENT
      );
    });

    it('passes leadMagnetId and slug to createFunnel', async () => {
      await POST(buildRequest(VALID_BODY));

      expect(mockCreateFunnel).toHaveBeenCalledWith(
        { type: 'user', userId: 'user-1' },
        expect.objectContaining({
          leadMagnetId: 'lm-1',
          slug: '5-step-lead-gen',
          theme: 'modern',
        })
      );
    });

    it('publishes the funnel', async () => {
      await POST(buildRequest(VALID_BODY));

      expect(mockPublishFunnel).toHaveBeenCalledWith(
        { type: 'user', userId: 'user-1' },
        'funnel-1',
        true
      );
    });
  });

  // ─── Validation errors ──────────────────────────────────────────────────

  describe('validation errors', () => {
    it('fails with 400 for missing title', async () => {
      const response = await POST(buildRequest({ ...VALID_BODY, title: '' }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Validation failed');
    });

    it('fails with 400 for invalid archetype', async () => {
      const response = await POST(buildRequest({ ...VALID_BODY, archetype: 'not-real' }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Validation failed');
    });

    it('fails with 400 for missing slug', async () => {
      const { slug: _slug, ...bodyNoSlug } = VALID_BODY;
      const response = await POST(buildRequest(bodyNoSlug));

      expect(response.status).toBe(400);
    });

    it('fails with 400 for slug with uppercase', async () => {
      const response = await POST(buildRequest({ ...VALID_BODY, slug: 'UpperCase' }));

      expect(response.status).toBe(400);
    });

    it('fails with 400 when content fails archetype publish schema', async () => {
      (validateContentForPublish as jest.Mock).mockReturnValueOnce({
        valid: false,
        missing_fields: ['content.headline', 'content.sections'],
        suggested_tool: 'update_lead_magnet',
        archetype_schema_hint:
          "Call get_archetype_schema('single-breakdown') to see required fields.",
        message: 'Cannot publish: content.headline, content.sections are missing.',
      });

      const response = await POST(buildRequest(VALID_BODY));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Cannot publish');
      expect(body.missing_fields).toEqual(['content.headline', 'content.sections']);
    });
  });

  // ─── Rollback ─────────────────────────────────────────────────────────

  describe('rollback on failure', () => {
    it('deletes lead magnet if createFunnel fails', async () => {
      mockCreateFunnel.mockRejectedValueOnce(
        Object.assign(new Error('Slug conflict'), { statusCode: 409 })
      );

      const response = await POST(buildRequest(VALID_BODY));

      expect(response.status).toBe(409);
      expect(mockDeleteLeadMagnet).toHaveBeenCalledWith({ type: 'user', userId: 'user-1' }, 'lm-1');
    });

    it('deletes funnel and lead magnet if publishFunnel fails', async () => {
      mockPublishFunnel.mockRejectedValueOnce(
        Object.assign(new Error('Username not set'), { statusCode: 400 })
      );

      const response = await POST(buildRequest(VALID_BODY));

      expect(response.status).toBe(400);
      expect(mockDeleteFunnel).toHaveBeenCalledWith({ type: 'user', userId: 'user-1' }, 'funnel-1');
      expect(mockDeleteLeadMagnet).toHaveBeenCalledWith({ type: 'user', userId: 'user-1' }, 'lm-1');
    });

    it('deletes lead magnet if updateLeadMagnetContent fails', async () => {
      mockUpdateLeadMagnetContent.mockRejectedValueOnce(
        Object.assign(new Error('Content save failed'), { statusCode: 500 })
      );

      const response = await POST(buildRequest(VALID_BODY));

      expect(response.status).toBe(500);
      expect(mockDeleteLeadMagnet).toHaveBeenCalledWith({ type: 'user', userId: 'user-1' }, 'lm-1');
      // Funnel should NOT have been created
      expect(mockCreateFunnel).not.toHaveBeenCalled();
    });

    it('still returns original error if cleanup also fails', async () => {
      mockCreateFunnel.mockRejectedValueOnce(
        Object.assign(new Error('Funnel creation failed'), { statusCode: 500 })
      );
      mockDeleteLeadMagnet.mockRejectedValueOnce(new Error('Cleanup also failed'));

      const response = await POST(buildRequest(VALID_BODY));
      const body = await response.json();

      // Must return original error, not cleanup error
      expect(response.status).toBe(500);
      expect(body.error).toBe('Funnel creation failed');
    });
  });

  // ─── Email sequence ──────────────────────────────────────────────────

  describe('with email_sequence', () => {
    const bodyWithEmails = {
      ...VALID_BODY,
      email_sequence: {
        emails: [
          { subject: 'Welcome!', body: 'Thanks for downloading.', delay_days: 0 },
          { subject: 'Day 2 follow-up', body: 'How was the guide?', delay_days: 2 },
        ],
      },
    };

    it('creates and activates email sequence on happy path', async () => {
      mockEmailGenerate.mockResolvedValueOnce({
        success: true,
        emailSequence: { id: 'seq-1', emails: [] },
      });
      mockEmailUpdate.mockResolvedValueOnce({
        success: true,
        emailSequence: { id: 'seq-1', emails: [] },
      });
      mockEmailActivate.mockResolvedValueOnce({ success: true });

      const response = await POST(buildRequest(bodyWithEmails));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.email_sequence_id).toBe('seq-1');
      expect(mockEmailGenerate).toHaveBeenCalledWith('lm-1', false, 'user-1');
      expect(mockEmailUpdate).toHaveBeenCalled();
      expect(mockEmailActivate).toHaveBeenCalledWith('user-1', 'lm-1');
    });

    it('succeeds with null email_sequence_id if email creation fails (non-fatal)', async () => {
      mockEmailGenerate.mockRejectedValueOnce(new Error('Email service down'));

      const response = await POST(buildRequest(bodyWithEmails));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.lead_magnet_id).toBe('lm-1');
      expect(body.funnel_id).toBe('funnel-1');
      expect(body.email_sequence_id).toBeNull();
    });

    it('validates email_sequence.emails has at least one email', async () => {
      const response = await POST(
        buildRequest({
          ...VALID_BODY,
          email_sequence: { emails: [] },
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Validation failed');
    });
  });
});
