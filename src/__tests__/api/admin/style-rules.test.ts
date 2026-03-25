/**
 * Tests for the Admin Style Rules API route handlers.
 * Covers GET/POST (list/create), PATCH (update), and POST compile.
 *
 * @jest-environment node
 */

// ─── Mocks (must be before imports) ────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/super-admin', () => ({
  isSuperAdmin: jest.fn(),
}));

jest.mock('@/server/services/style-rules.service', () => ({
  listRules: jest.fn(),
  createRule: jest.fn(),
  updateRule: jest.fn(),
  compileGlobalRules: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/style-rules/route';
import { PATCH } from '@/app/api/admin/style-rules/[id]/route';
import { POST as POST_COMPILE } from '@/app/api/admin/style-rules/compile/route';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as service from '@/server/services/style-rules.service';

// ─── Typed mocks ────────────────────────────────────────────────────────────

const mockAuth = auth as jest.Mock;
const mockIsSuperAdmin = isSuperAdmin as jest.Mock;
const mockListRules = service.listRules as jest.Mock;
const mockCreateRule = service.createRule as jest.Mock;
const mockUpdateRule = service.updateRule as jest.Mock;
const mockCompileGlobalRules = service.compileGlobalRules as jest.Mock;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makePatchRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const ADMIN_SESSION = { user: { id: 'admin-1', email: 'admin@test.com' } };
const USER_SESSION = { user: { id: 'user-1', email: 'user@test.com' } };

const SAMPLE_RULE = {
  id: 'rule-uuid-1',
  rule_text: 'Never use placeholder text in generated content.',
  pattern_name: 'manual',
  scope: 'global',
  status: 'proposed',
  team_id: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Admin Style Rules API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/admin/style-rules ─────────────────────────────────────────

  describe('GET /api/admin/style-rules', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await GET(makeGetRequest('http://localhost/api/admin/style-rules'));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when session has no user id', async () => {
      mockAuth.mockResolvedValue({ user: {} });

      const res = await GET(makeGetRequest('http://localhost/api/admin/style-rules'));

      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue(USER_SESSION);
      mockIsSuperAdmin.mockResolvedValue(false);

      const res = await GET(makeGetRequest('http://localhost/api/admin/style-rules'));

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
      expect(mockIsSuperAdmin).toHaveBeenCalledWith('user-1');
    });

    it('returns 200 with rules array for super admin', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListRules.mockResolvedValue([SAMPLE_RULE]);

      const res = await GET(makeGetRequest('http://localhost/api/admin/style-rules'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rules).toHaveLength(1);
      expect(body.rules[0].id).toBe('rule-uuid-1');
      expect(mockListRules).toHaveBeenCalledWith({ status: undefined, scope: undefined });
    });

    it('passes status filter to service when provided', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListRules.mockResolvedValue([]);

      const res = await GET(
        makeGetRequest('http://localhost/api/admin/style-rules?status=approved')
      );

      expect(res.status).toBe(200);
      expect(mockListRules).toHaveBeenCalledWith({ status: 'approved', scope: undefined });
    });

    it('passes scope filter to service when provided', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListRules.mockResolvedValue([]);

      const res = await GET(makeGetRequest('http://localhost/api/admin/style-rules?scope=global'));

      expect(res.status).toBe(200);
      expect(mockListRules).toHaveBeenCalledWith({ status: undefined, scope: 'global' });
    });

    it('passes both status and scope filters when provided', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListRules.mockResolvedValue([]);

      const res = await GET(
        makeGetRequest('http://localhost/api/admin/style-rules?status=proposed&scope=global')
      );

      expect(res.status).toBe(200);
      expect(mockListRules).toHaveBeenCalledWith({ status: 'proposed', scope: 'global' });
    });
  });

  // ─── POST /api/admin/style-rules ────────────────────────────────────────

  describe('POST /api/admin/style-rules', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await POST(
        makePostRequest('http://localhost/api/admin/style-rules', {
          rule_text: 'Some rule text here.',
        })
      );

      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue(USER_SESSION);
      mockIsSuperAdmin.mockResolvedValue(false);

      const res = await POST(
        makePostRequest('http://localhost/api/admin/style-rules', {
          rule_text: 'Some rule text here.',
        })
      );

      expect(res.status).toBe(403);
    });

    it('returns 400 when rule_text is too short (< 10 chars)', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);

      const res = await POST(
        makePostRequest('http://localhost/api/admin/style-rules', { rule_text: 'Short' })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('returns 400 when rule_text is missing', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);

      const res = await POST(makePostRequest('http://localhost/api/admin/style-rules', {}));

      expect(res.status).toBe(400);
    });

    it('returns 201 and created rule on success', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockCreateRule.mockResolvedValue(SAMPLE_RULE);

      const res = await POST(
        makePostRequest('http://localhost/api/admin/style-rules', {
          rule_text: 'Never use placeholder text in generated content.',
        })
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.rule.id).toBe('rule-uuid-1');
      expect(mockCreateRule).toHaveBeenCalledTimes(1);
    });

    it('passes pattern_name and scope to service when provided', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockCreateRule.mockResolvedValue({ ...SAMPLE_RULE, scope: 'team', pattern_name: 'tone' });

      const res = await POST(
        makePostRequest('http://localhost/api/admin/style-rules', {
          rule_text: 'Always write in an active voice throughout.',
          pattern_name: 'tone',
          scope: 'team',
          team_id: '550e8400-e29b-41d4-a716-446655440000',
        })
      );

      expect(res.status).toBe(201);
      expect(mockCreateRule).toHaveBeenCalledWith(
        expect.objectContaining({ pattern_name: 'tone', scope: 'team' }),
        'admin-1'
      );
    });
  });

  // ─── PATCH /api/admin/style-rules/[id] ──────────────────────────────────

  describe('PATCH /api/admin/style-rules/[id]', () => {
    const ruleId = 'rule-uuid-1';
    const paramsPromise = Promise.resolve({ id: ruleId });

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {
          status: 'approved',
        }),
        { params: paramsPromise }
      );

      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue(USER_SESSION);
      mockIsSuperAdmin.mockResolvedValue(false);

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {
          status: 'approved',
        }),
        { params: paramsPromise }
      );

      expect(res.status).toBe(403);
    });

    it('returns 400 when body is empty (no fields)', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {}),
        { params: paramsPromise }
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('returns 400 when rule_text is too short', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {
          rule_text: 'Short',
        }),
        { params: paramsPromise }
      );

      expect(res.status).toBe(400);
    });

    it('returns 404 when rule is not found (service throws 404)', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockUpdateRule.mockRejectedValue(
        Object.assign(new Error('Rule not found'), { statusCode: 404 })
      );

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {
          status: 'approved',
        }),
        { params: paramsPromise }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Rule not found');
    });

    it('returns 200 and updated rule when status is patched', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      const updatedRule = { ...SAMPLE_RULE, status: 'approved', reviewed_by: 'admin-1' };
      mockUpdateRule.mockResolvedValue(updatedRule);

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {
          status: 'approved',
        }),
        { params: paramsPromise }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rule.status).toBe('approved');
      expect(mockUpdateRule).toHaveBeenCalledWith(ruleId, { status: 'approved' }, 'admin-1');
    });

    it('returns 200 and updated rule when rule_text is patched', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      const newText = 'Updated rule text that is long enough.';
      const updatedRule = { ...SAMPLE_RULE, rule_text: newText };
      mockUpdateRule.mockResolvedValue(updatedRule);

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {
          rule_text: newText,
        }),
        { params: paramsPromise }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rule.rule_text).toBe(newText);
    });

    it('returns 500 when service throws unexpected error', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockUpdateRule.mockRejectedValue(new Error('Database connection failed'));

      const res = await PATCH(
        makePatchRequest(`http://localhost/api/admin/style-rules/${ruleId}`, {
          status: 'rejected',
        }),
        { params: paramsPromise }
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Database connection failed');
    });
  });

  // ─── POST /api/admin/style-rules/compile ────────────────────────────────

  describe('POST /api/admin/style-rules/compile', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await POST_COMPILE();

      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue(USER_SESSION);
      mockIsSuperAdmin.mockResolvedValue(false);

      const res = await POST_COMPILE();

      expect(res.status).toBe(403);
    });

    it('returns 200 with ruleCount on success', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockCompileGlobalRules.mockResolvedValue({ ruleCount: 7 });

      const res = await POST_COMPILE();

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ruleCount).toBe(7);
      expect(mockCompileGlobalRules).toHaveBeenCalledWith('admin-1');
    });

    it('returns 500 when compile service throws', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockCompileGlobalRules.mockRejectedValue(new Error('Prompt registry unavailable'));

      const res = await POST_COMPILE();

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Prompt registry unavailable');
    });

    it('returns generic message when non-Error is thrown', async () => {
      mockAuth.mockResolvedValue(ADMIN_SESSION);
      mockIsSuperAdmin.mockResolvedValue(true);
      mockCompileGlobalRules.mockRejectedValue('string error');

      const res = await POST_COMPILE();

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Compile failed');
    });
  });
});
