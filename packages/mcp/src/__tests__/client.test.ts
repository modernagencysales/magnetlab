import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MagnetLabClient } from '../client.js'

// Track all fetch calls
let fetchCalls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = []

// Mock global fetch
const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
  fetchCalls.push({
    url,
    method: init?.method || 'GET',
    headers: (init?.headers || {}) as Record<string, string>,
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  })
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ success: true }),
  }
})

vi.stubGlobal('fetch', mockFetch)

describe('MagnetLabClient', () => {
  let client: MagnetLabClient

  beforeEach(() => {
    fetchCalls = []
    mockFetch.mockClear()
    client = new MagnetLabClient('test-api-key-123')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function lastCall() {
    return fetchCalls[fetchCalls.length - 1]
  }

  // ── Auth & Base URL ───────────────────────────────────────

  describe('Auth & URL construction', () => {
    it('sends Authorization header with Bearer token', async () => {
      await client.listEmailFlows()
      expect(lastCall().headers['Authorization']).toBe('Bearer test-api-key-123')
    })

    it('sends Content-Type application/json', async () => {
      await client.listEmailFlows()
      expect(lastCall().headers['Content-Type']).toBe('application/json')
    })

    it('uses default base URL', async () => {
      await client.listEmailFlows()
      expect(lastCall().url).toContain('https://www.magnetlab.app/api')
    })

    it('respects custom base URL', async () => {
      const customClient = new MagnetLabClient('key', {
        baseUrl: 'http://localhost:3000/api',
      })
      await customClient.listEmailFlows()
      expect(lastCall().url).toContain('http://localhost:3000/api')
    })
  })

  // ── Email System — the bug fix (snake_case body fields) ──

  describe('Email System — snake_case fields in request body', () => {
    it('createEmailFlow sends trigger_type (not triggerType)', async () => {
      await client.createEmailFlow({
        name: 'Welcome',
        trigger_type: 'lead_magnet',
        trigger_lead_magnet_id: 'lm-1',
      })

      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toContain('/email/flows')
      expect(call.body).toEqual({
        name: 'Welcome',
        trigger_type: 'lead_magnet',
        trigger_lead_magnet_id: 'lm-1',
      })
      // Must NOT have camelCase keys
      expect(call.body).not.toHaveProperty('triggerType')
      expect(call.body).not.toHaveProperty('triggerLeadMagnetId')
    })

    it('updateEmailFlow sends trigger_type (not triggerType)', async () => {
      await client.updateEmailFlow('flow-1', {
        name: 'Updated',
        trigger_type: 'manual',
        status: 'active',
      })

      const call = lastCall()
      expect(call.method).toBe('PUT')
      expect(call.url).toContain('/email/flows/flow-1')
      expect(call.body).toEqual({
        name: 'Updated',
        trigger_type: 'manual',
        status: 'active',
      })
      expect(call.body).not.toHaveProperty('triggerType')
    })

    it('addFlowStep sends step_number and delay_days (not camelCase)', async () => {
      await client.addFlowStep('flow-1', {
        step_number: 2,
        subject: 'Day 3',
        body: '<p>Follow up</p>',
        delay_days: 3,
      })

      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toContain('/email/flows/flow-1/steps')
      expect(call.body).toEqual({
        step_number: 2,
        subject: 'Day 3',
        body: '<p>Follow up</p>',
        delay_days: 3,
      })
      expect(call.body).not.toHaveProperty('stepNumber')
      expect(call.body).not.toHaveProperty('delayDays')
    })

    it('updateBroadcast sends audience_filter (not audienceFilter)', async () => {
      await client.updateBroadcast('bc-1', {
        subject: 'New Subject',
        audience_filter: { engagement: 'opened_30d' },
      })

      const call = lastCall()
      expect(call.method).toBe('PUT')
      expect(call.url).toContain('/email/broadcasts/bc-1')
      expect(call.body).toEqual({
        subject: 'New Subject',
        audience_filter: { engagement: 'opened_30d' },
      })
      expect(call.body).not.toHaveProperty('audienceFilter')
    })

    it('addSubscriber sends first_name and last_name (not camelCase)', async () => {
      await client.addSubscriber({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      })

      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toContain('/email/subscribers')
      expect(call.body).toEqual({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      })
      expect(call.body).not.toHaveProperty('firstName')
      expect(call.body).not.toHaveProperty('lastName')
    })

    it('generateFlowEmails sends stepCount (API exception)', async () => {
      await client.generateFlowEmails('flow-1', 7)

      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toContain('/email/flows/flow-1/generate')
      expect(call.body).toEqual({ stepCount: 7 })
    })

    it('generateFlowEmails sends empty body when no step count', async () => {
      await client.generateFlowEmails('flow-1')

      const call = lastCall()
      expect(call.body).toEqual({})
    })
  })

  // ── Email System — read operations ────────────────────────

  describe('Email System — read operations', () => {
    it('listEmailFlows uses GET', async () => {
      await client.listEmailFlows()
      expect(lastCall().method).toBe('GET')
      expect(lastCall().url).toContain('/email/flows')
    })

    it('getEmailFlow uses GET with id in path', async () => {
      await client.getEmailFlow('flow-abc')
      expect(lastCall().method).toBe('GET')
      expect(lastCall().url).toContain('/email/flows/flow-abc')
    })

    it('listBroadcasts uses GET', async () => {
      await client.listBroadcasts()
      expect(lastCall().method).toBe('GET')
      expect(lastCall().url).toContain('/email/broadcasts')
    })

    it('listSubscribers uses GET with query params', async () => {
      await client.listSubscribers({ search: 'john', status: 'active', page: 2 })
      expect(lastCall().method).toBe('GET')
      expect(lastCall().url).toContain('search=john')
      expect(lastCall().url).toContain('status=active')
      expect(lastCall().url).toContain('page=2')
    })

    it('deleteEmailFlow uses DELETE', async () => {
      await client.deleteEmailFlow('flow-1')
      expect(lastCall().method).toBe('DELETE')
      expect(lastCall().url).toContain('/email/flows/flow-1')
    })

    it('unsubscribeSubscriber uses DELETE', async () => {
      await client.unsubscribeSubscriber('sub-1')
      expect(lastCall().method).toBe('DELETE')
      expect(lastCall().url).toContain('/email/subscribers/sub-1')
    })

    it('sendBroadcast uses POST', async () => {
      await client.sendBroadcast('bc-1')
      expect(lastCall().method).toBe('POST')
      expect(lastCall().url).toContain('/email/broadcasts/bc-1/send')
    })
  })

  // ── Funnel methods — verify camelCase is still used ───────

  describe('Funnels — camelCase body', () => {
    it('createFunnel sends camelCase body', async () => {
      await client.createFunnel({
        slug: 'my-funnel',
        optinHeadline: 'Get the Guide',
        primaryColor: '#8b5cf6',
      })
      const call = lastCall()
      expect(call.body).toHaveProperty('optinHeadline')
      expect(call.body).toHaveProperty('primaryColor')
    })

    it('updateFunnel sends PUT with id in path', async () => {
      await client.updateFunnel('funnel-1', { slug: 'updated' })
      expect(lastCall().method).toBe('PUT')
      expect(lastCall().url).toContain('/funnel/funnel-1')
    })
  })

  // ── Lead Magnet methods ───────────────────────────────────

  describe('Lead Magnets', () => {
    it('listLeadMagnets uses GET with query params', async () => {
      await client.listLeadMagnets({ status: 'published', limit: 5 })
      expect(lastCall().method).toBe('GET')
      expect(lastCall().url).toContain('status=published')
      expect(lastCall().url).toContain('limit=5')
    })

    it('createLeadMagnet uses POST', async () => {
      await client.createLeadMagnet({ title: 'Test', archetype: 'prompt' })
      expect(lastCall().method).toBe('POST')
      expect(lastCall().url).toContain('/lead-magnet')
    })

    it('deleteLeadMagnet uses DELETE with id in path', async () => {
      await client.deleteLeadMagnet('lm-1')
      expect(lastCall().method).toBe('DELETE')
      expect(lastCall().url).toContain('/lead-magnet/lm-1')
    })
  })

  // ── Email Sequences — verify camelCase still used ─────────

  describe('Email Sequences — camelCase body', () => {
    it('updateEmailSequence sends replyTrigger (camelCase)', async () => {
      await client.updateEmailSequence('lm-1', {
        emails: [{ day: 1, subject: 'Hi', body: 'Hello', replyTrigger: 'keyword' }],
      })
      const call = lastCall()
      expect(call.body.emails[0]).toHaveProperty('replyTrigger')
      expect(call.body.emails[0]).not.toHaveProperty('reply_trigger')
    })
  })

  // ── Content Pipeline — spot check ─────────────────────────

  describe('Content Pipeline', () => {
    it('schedulePost sends camelCase body', async () => {
      await client.schedulePost({ postId: 'post-1', scheduledTime: '2026-03-01T10:00:00Z' })
      expect(lastCall().body).toEqual({
        postId: 'post-1',
        scheduledTime: '2026-03-01T10:00:00Z',
      })
    })

    it('createPostingSlot sends camelCase body', async () => {
      await client.createPostingSlot({ dayOfWeek: 1, time: '09:00' })
      expect(lastCall().body).toEqual({ dayOfWeek: 1, time: '09:00' })
    })
  })

  // ── Error handling ────────────────────────────────────────

  describe('Error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: async () => ({ error: 'Bad request' }),
      })

      await expect(client.listEmailFlows()).rejects.toThrow('Bad request')
    })

    it('handles non-JSON error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => {
          throw new Error('not json')
        },
      })

      await expect(client.listEmailFlows()).rejects.toThrow('Unknown error')
    })

    it('follows redirects preserving Authorization header', async () => {
      let callCount = 0
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        fetchCalls.push({
          url,
          method: init?.method || 'GET',
          headers: (init?.headers || {}) as Record<string, string>,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        })
        callCount++
        if (callCount === 1) {
          return {
            ok: false,
            status: 301,
            headers: new Headers({ location: 'https://www.magnetlab.app/api/email/flows/' }),
            json: async () => ({}),
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ flows: [] }),
        }
      })

      await client.listEmailFlows()
      // Second call should preserve Authorization
      expect(fetchCalls.length).toBeGreaterThanOrEqual(2)
      expect(fetchCalls[1].headers['Authorization']).toBe('Bearer test-api-key-123')
    })
  })

  // ── CSV export handling ───────────────────────────────────

  describe('CSV response handling', () => {
    it('returns csv text for CSV content-type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: async () => 'email,name\ntest@test.com,Test',
        json: async () => ({}),
      })

      const result = await client.exportLeads()
      expect(result).toEqual({ csv: 'email,name\ntest@test.com,Test' })
    })
  })
})
