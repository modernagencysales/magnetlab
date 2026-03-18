/** Client tests for MCP v2. Verifies all 35 client methods make correct HTTP calls. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MagnetLabClient } from '../client.js';

// ─── Mock Fetch ───────────────────────────────────────────────────────────────

let fetchCalls: Array<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}> = [];

const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
  fetchCalls.push({
    url,
    method: init?.method || 'GET',
    headers: (init?.headers || {}) as Record<string, string>,
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ success: true }),
  };
});

vi.stubGlobal('fetch', mockFetch);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastCall() {
  return fetchCalls[fetchCalls.length - 1];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MagnetLabClient', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    fetchCalls = [];
    mockFetch.mockClear();
    client = new MagnetLabClient('test-api-key-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Auth & Base URL ───────────────────────────────────────────────────────

  describe('Auth & URL construction', () => {
    it('sends Authorization header with Bearer token', async () => {
      await client.listLeadMagnets();
      expect(lastCall().headers['Authorization']).toBe('Bearer test-api-key-123');
    });

    it('sends Content-Type application/json', async () => {
      await client.listLeadMagnets();
      expect(lastCall().headers['Content-Type']).toBe('application/json');
    });

    it('uses default base URL', async () => {
      await client.listLeadMagnets();
      expect(lastCall().url).toContain('https://www.magnetlab.app/api');
    });

    it('respects custom base URL', async () => {
      const customClient = new MagnetLabClient('key', {
        baseUrl: 'http://localhost:3000/api',
      });
      await customClient.listLeadMagnets();
      expect(lastCall().url).toContain('http://localhost:3000/api');
    });
  });

  // ── Lead Magnets ─────────────────────────────────────────────────────────

  describe('Lead Magnets', () => {
    it('listLeadMagnets uses GET with query params', async () => {
      await client.listLeadMagnets({ status: 'published', limit: 5, offset: 10 });
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/lead-magnet');
      expect(lastCall().url).toContain('status=published');
      expect(lastCall().url).toContain('limit=5');
      expect(lastCall().url).toContain('offset=10');
    });

    it('listLeadMagnets with no params has no query string', async () => {
      await client.listLeadMagnets();
      expect(lastCall().url).toMatch(/\/lead-magnet$/);
    });

    it('getLeadMagnet uses GET with id in path', async () => {
      await client.getLeadMagnet('lm-abc');
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/lead-magnet/lm-abc');
    });

    it('createLeadMagnet uses POST', async () => {
      await client.createLeadMagnet({ title: 'Test', archetype: 'prompt' });
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/lead-magnet');
      expect(lastCall().body).toEqual({ title: 'Test', archetype: 'prompt' });
    });

    it('updateLeadMagnetContent uses PATCH with content', async () => {
      await client.updateLeadMagnetContent('lm-1', { headline: 'New' });
      expect(lastCall().method).toBe('PATCH');
      expect(lastCall().url).toContain('/lead-magnet/lm-1');
      expect(lastCall().body).toEqual({ content: { headline: 'New' } });
    });

    it('updateLeadMagnetContent includes expected_version when provided', async () => {
      await client.updateLeadMagnetContent('lm-1', { headline: 'New' }, 3);
      expect(lastCall().body).toEqual({
        content: { headline: 'New' },
        expected_version: 3,
      });
    });

    it('updateLeadMagnetContent omits expected_version when undefined', async () => {
      await client.updateLeadMagnetContent('lm-1', { headline: 'New' });
      expect(lastCall().body).not.toHaveProperty('expected_version');
    });

    it('deleteLeadMagnet uses DELETE with id in path', async () => {
      await client.deleteLeadMagnet('lm-1');
      expect(lastCall().method).toBe('DELETE');
      expect(lastCall().url).toContain('/lead-magnet/lm-1');
    });

    it('launchLeadMagnet uses POST', async () => {
      await client.launchLeadMagnet({ lead_magnet_id: 'lm-1', slug: 'my-guide' });
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/lead-magnet/launch');
      expect(lastCall().body).toEqual({
        lead_magnet_id: 'lm-1',
        slug: 'my-guide',
      });
    });
  });

  // ── Funnels ───────────────────────────────────────────────────────────────

  describe('Funnels', () => {
    it('listFunnels uses GET', async () => {
      await client.listFunnels();
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/funnel/all');
    });

    it('getFunnel uses GET with id in path', async () => {
      await client.getFunnel('funnel-abc');
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/funnel/funnel-abc');
    });

    it('createFunnel sends camelCase body', async () => {
      await client.createFunnel({
        slug: 'my-funnel',
        optinHeadline: 'Get the Guide',
        primaryColor: '#8b5cf6',
      });
      const call = lastCall();
      expect(call.method).toBe('POST');
      expect(call.body).toHaveProperty('optinHeadline');
      expect(call.body).toHaveProperty('primaryColor');
      expect(call.body).toHaveProperty('slug', 'my-funnel');
    });

    it('updateFunnel sends PUT with id in path', async () => {
      await client.updateFunnel('funnel-1', { slug: 'updated' });
      expect(lastCall().method).toBe('PUT');
      expect(lastCall().url).toContain('/funnel/funnel-1');
    });

    it('deleteFunnel uses DELETE', async () => {
      await client.deleteFunnel('funnel-1');
      expect(lastCall().method).toBe('DELETE');
      expect(lastCall().url).toContain('/funnel/funnel-1');
    });

    it('publishFunnel sends POST with { publish: true }', async () => {
      await client.publishFunnel('funnel-1');
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/funnel/funnel-1/publish');
      expect(lastCall().body).toEqual({ publish: true });
    });

    it('unpublishFunnel sends POST with { publish: false }', async () => {
      await client.unpublishFunnel('funnel-1');
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/funnel/funnel-1/publish');
      expect(lastCall().body).toEqual({ publish: false });
    });
  });

  // ── Knowledge Base ────────────────────────────────────────────────────────

  describe('Knowledge Base', () => {
    it('searchKnowledge uses GET with query params', async () => {
      await client.searchKnowledge({ query: 'pricing', category: 'insight' });
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/content-pipeline/knowledge');
      expect(lastCall().url).toContain('q=pricing');
      expect(lastCall().url).toContain('category=insight');
    });

    it('browseKnowledge uses GET with filter params', async () => {
      await client.browseKnowledge({ category: 'question', tag: 'sales', limit: 10 });
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/content-pipeline/knowledge');
      expect(lastCall().url).toContain('category=question');
      expect(lastCall().url).toContain('tag=sales');
      expect(lastCall().url).toContain('limit=10');
    });

    it('getKnowledgeClusters uses GET', async () => {
      await client.getKnowledgeClusters();
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/content-pipeline/knowledge/clusters');
    });

    it('askKnowledge uses POST with question body', async () => {
      await client.askKnowledge({ question: 'What is our pricing strategy?' });
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/content-pipeline/knowledge/ask');
      expect(lastCall().body).toEqual({ question: 'What is our pricing strategy?' });
    });
  });

  // ── Transcripts ──────────────────────────────────────────────────────────

  describe('Transcripts', () => {
    it('submitTranscript uses POST', async () => {
      await client.submitTranscript({ transcript: 'A'.repeat(100), title: 'Call' });
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/content-pipeline/transcripts');
      expect(lastCall().body).toEqual({ transcript: 'A'.repeat(100), title: 'Call' });
    });
  });

  // ── Posts ─────────────────────────────────────────────────────────────────

  describe('Posts', () => {
    it('listPosts uses GET with query params', async () => {
      await client.listPosts({ status: 'draft', isBuffer: true, limit: 10 });
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/content-pipeline/posts');
      expect(lastCall().url).toContain('status=draft');
      expect(lastCall().url).toContain('is_buffer=true');
      expect(lastCall().url).toContain('limit=10');
    });

    it('getPost uses GET with id in path', async () => {
      await client.getPost('post-1');
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/content-pipeline/posts/post-1');
    });

    it('createPost uses POST', async () => {
      await client.createPost({
        body: 'My LinkedIn post',
        title: 'Day 1',
        pillar: 'teaching_promotion',
        content_type: 'insight',
      });
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/content-pipeline/posts');
      expect(lastCall().body).toEqual({
        body: 'My LinkedIn post',
        title: 'Day 1',
        pillar: 'teaching_promotion',
        content_type: 'insight',
      });
    });

    it('updatePost uses PATCH with id in path', async () => {
      await client.updatePost('post-1', { draft_content: 'updated' });
      expect(lastCall().method).toBe('PATCH');
      expect(lastCall().url).toContain('/content-pipeline/posts/post-1');
      expect(lastCall().body).toEqual({ draft_content: 'updated' });
    });

    it('deletePost uses DELETE', async () => {
      await client.deletePost('post-1');
      expect(lastCall().method).toBe('DELETE');
      expect(lastCall().url).toContain('/content-pipeline/posts/post-1');
    });

    it('publishPost uses POST', async () => {
      await client.publishPost('post-1');
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/content-pipeline/posts/post-1/publish');
    });

    it('scheduleContentWeek uses POST', async () => {
      await client.scheduleContentWeek({
        start_date: '2026-03-16',
        posts_per_day: 2,
        pillars: ['teaching_promotion', 'human_personal'],
        auto_approve: true,
      });
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/content-pipeline/posts/schedule-week');
      expect(lastCall().body).toEqual({
        start_date: '2026-03-16',
        posts_per_day: 2,
        pillars: ['teaching_promotion', 'human_personal'],
        auto_approve: true,
      });
    });
  });

  // ── Email Sequences ──────────────────────────────────────────────────────

  describe('Email Sequences', () => {
    it('getEmailSequence uses GET with leadMagnetId in path', async () => {
      await client.getEmailSequence('lm-1');
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/email-sequence/lm-1');
    });

    it('saveEmailSequence uses PUT with leadMagnetId in path', async () => {
      await client.saveEmailSequence('lm-1', {
        emails: [{ day: 0, subject: 'Welcome', body: '<p>Hi</p>' }],
        status: 'draft',
      });
      expect(lastCall().method).toBe('PUT');
      expect(lastCall().url).toContain('/email-sequence/lm-1');
      expect(lastCall().body).toEqual({
        emails: [{ day: 0, subject: 'Welcome', body: '<p>Hi</p>' }],
        status: 'draft',
      });
    });

    it('saveEmailSequence includes replyTrigger in camelCase', async () => {
      await client.saveEmailSequence('lm-1', {
        emails: [{ day: 1, subject: 'Follow up', body: '<p>Hey</p>', replyTrigger: 'welcome' }],
      });
      expect(lastCall().body.emails[0]).toHaveProperty('replyTrigger', 'welcome');
    });

    it('activateEmailSequence uses POST', async () => {
      await client.activateEmailSequence('lm-1');
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/email-sequence/lm-1/activate');
    });
  });

  // ── Leads ─────────────────────────────────────────────────────────────────

  describe('Leads', () => {
    it('listLeads uses GET with query params', async () => {
      await client.listLeads({ search: 'john', limit: 20, qualified: true });
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('search=john');
      expect(lastCall().url).toContain('limit=20');
      expect(lastCall().url).toContain('qualified=true');
    });

    it('getLead uses GET with id in path', async () => {
      await client.getLead('lead-1');
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/leads/lead-1');
    });

    it('exportLeads uses GET with filter params', async () => {
      await client.exportLeads({ funnelId: 'f-1', qualified: false });
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/leads/export');
      expect(lastCall().url).toContain('funnelId=f-1');
      expect(lastCall().url).toContain('qualified=false');
    });
  });

  // ── Business Context ──────────────────────────────────────────────────────

  describe('Business Context', () => {
    it('getBusinessContext uses GET', async () => {
      await client.getBusinessContext();
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/content-pipeline/business-context');
    });
  });

  // ── Analytics / Feedback ──────────────────────────────────────────────────

  describe('Analytics / Feedback', () => {
    it('getPerformanceInsights uses GET with period', async () => {
      await client.getPerformanceInsights('7d');
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/analytics/performance-insights');
      expect(lastCall().url).toContain('period=7d');
    });

    it('getPerformanceInsights uses GET without period', async () => {
      await client.getPerformanceInsights();
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/analytics/performance-insights');
      expect(lastCall().url).not.toContain('period=');
    });

    it('getRecommendations uses GET', async () => {
      await client.getRecommendations();
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/analytics/recommendations');
    });
  });

  // ── Teams ─────────────────────────────────────────────────────────────────

  describe('Teams', () => {
    it('listTeams uses GET', async () => {
      await client.listTeams();
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/teams');
    });
  });

  // ── Content Queue ─────────────────────────────────────────────────────────

  describe('Content Queue', () => {
    it('listContentQueue uses GET', async () => {
      await client.listContentQueue();
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toContain('/content-queue');
    });

    it('updateQueuePost uses PATCH with post id in path', async () => {
      await client.updateQueuePost('post-abc', {
        draft_content: 'Updated text',
        mark_edited: true,
      });
      expect(lastCall().method).toBe('PATCH');
      expect(lastCall().url).toContain('/content-queue/posts/post-abc');
      expect(lastCall().body).toMatchObject({ draft_content: 'Updated text', mark_edited: true });
    });

    it('updateQueuePost sends only provided fields', async () => {
      await client.updateQueuePost('post-xyz', { image_urls: ['https://example.com/img.png'] });
      expect(lastCall().method).toBe('PATCH');
      expect(lastCall().url).toContain('/content-queue/posts/post-xyz');
      expect(lastCall().body).toMatchObject({ image_urls: ['https://example.com/img.png'] });
    });

    it('submitQueueBatch uses POST with team_id in body', async () => {
      await client.submitQueueBatch('team-123');
      expect(lastCall().method).toBe('POST');
      expect(lastCall().url).toContain('/content-queue/submit');
      expect(lastCall().body).toMatchObject({ team_id: 'team-123' });
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(client.listLeadMagnets()).rejects.toThrow('Bad request');
    });

    it('handles non-JSON error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => {
          throw new Error('not json');
        },
      });

      await expect(client.listLeadMagnets()).rejects.toThrow('Unknown error');
    });

    it('follows redirects preserving Authorization header', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        fetchCalls.push({
          url,
          method: init?.method || 'GET',
          headers: (init?.headers || {}) as Record<string, string>,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        });
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 301,
            headers: new Headers({ location: 'https://www.magnetlab.app/api/lead-magnet/' }),
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ leadMagnets: [] }),
        };
      });

      await client.listLeadMagnets();
      expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
      expect(fetchCalls[1].headers['Authorization']).toBe('Bearer test-api-key-123');
    });
  });

  // ── CSV export handling ─────────────────────────────────────────────────

  describe('CSV response handling', () => {
    it('returns csv text for CSV content-type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: async () => 'email,name\ntest@test.com,Test',
        json: async () => ({}),
      });

      const result = await client.exportLeads();
      expect(result).toEqual({ csv: 'email,name\ntest@test.com,Test' });
    });
  });
});
