/**
 * @jest-environment node
 */

// ============================================
// Mock Supabase chain
// ============================================

const mockInsert = jest.fn();
const mockUpsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

function wireChain() {
  mockFrom.mockReturnValue({
    insert: mockInsert,
    upsert: mockUpsert,
    update: mockUpdate,
    select: mockSelect,
  });
  // upsert -> .select('id') -> .single()
  mockUpsert.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq });
  mockSingle.mockResolvedValue({ data: { id: 'lead-1' }, error: null });
  // insert -> { error: null }
  mockInsert.mockResolvedValue({ error: null });
  // update -> .eq() -> .eq()
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ eq: mockEq, error: null, data: null });
}

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import {
  normalizeLinkedInUrl,
  splitName,
  upsertSignalLead,
  recordSignalEvent,
  updateSignalCounts,
  processEngagers,
} from '@/lib/services/signal-engine';
import { logError } from '@/lib/utils/logger';

describe('signal-engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireChain();
  });

  // ----------------------------------------------------------------
  // normalizeLinkedInUrl
  // ----------------------------------------------------------------
  describe('normalizeLinkedInUrl', () => {
    it('lowercases the URL', () => {
      expect(normalizeLinkedInUrl('https://www.LinkedIn.com/in/JohnDoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
    });

    it('strips query params', () => {
      expect(
        normalizeLinkedInUrl('https://www.linkedin.com/in/johndoe?utm_source=google&ref=abc')
      ).toBe('https://www.linkedin.com/in/johndoe');
    });

    it('strips fragment', () => {
      expect(
        normalizeLinkedInUrl('https://www.linkedin.com/in/johndoe#section')
      ).toBe('https://www.linkedin.com/in/johndoe');
    });

    it('removes trailing slash', () => {
      expect(normalizeLinkedInUrl('https://www.linkedin.com/in/johndoe/')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
    });

    it('prepends https://www.linkedin.com for paths starting with /', () => {
      expect(normalizeLinkedInUrl('/in/johndoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
    });

    it('prepends https://www.linkedin.com/ for bare paths', () => {
      expect(normalizeLinkedInUrl('in/johndoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
    });

    it('handles http:// by preserving origin', () => {
      const result = normalizeLinkedInUrl('http://www.linkedin.com/in/johndoe');
      expect(result).toBe('http://www.linkedin.com/in/johndoe');
    });

    it('strips both query params and trailing slash', () => {
      expect(
        normalizeLinkedInUrl('https://www.linkedin.com/in/johndoe/?ref=123')
      ).toBe('https://www.linkedin.com/in/johndoe');
    });

    it('trims whitespace', () => {
      expect(normalizeLinkedInUrl('  https://www.linkedin.com/in/johndoe  ')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
    });

    it('handles company URLs', () => {
      expect(
        normalizeLinkedInUrl('https://www.linkedin.com/company/acme-corp/')
      ).toBe('https://www.linkedin.com/company/acme-corp');
    });
  });

  // ----------------------------------------------------------------
  // splitName
  // ----------------------------------------------------------------
  describe('splitName', () => {
    it('splits "John Doe" into first and last', () => {
      expect(splitName('John Doe')).toEqual({ firstName: 'John', lastName: 'Doe' });
    });

    it('handles single name', () => {
      expect(splitName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' });
    });

    it('handles multiple parts (first + rest as last)', () => {
      expect(splitName('John Michael Smith')).toEqual({
        firstName: 'John',
        lastName: 'Michael Smith',
      });
    });

    it('handles empty string', () => {
      expect(splitName('')).toEqual({ firstName: '', lastName: '' });
    });

    it('handles whitespace-only string', () => {
      expect(splitName('   ')).toEqual({ firstName: '', lastName: '' });
    });

    it('handles extra whitespace between words', () => {
      expect(splitName('  John    Doe  ')).toEqual({ firstName: 'John', lastName: 'Doe' });
    });

    it('handles tab-separated names', () => {
      expect(splitName('John\tDoe')).toEqual({ firstName: 'John', lastName: 'Doe' });
    });
  });

  // ----------------------------------------------------------------
  // upsertSignalLead
  // ----------------------------------------------------------------
  describe('upsertSignalLead', () => {
    it('calls upsert on signal_leads with correct params', async () => {
      const result = await upsertSignalLead({
        user_id: 'user-1',
        linkedin_url: 'https://www.linkedin.com/in/janedoe/',
        first_name: 'Jane',
        last_name: 'Doe',
        headline: 'CEO at Acme',
      });

      expect(result).toEqual({ id: 'lead-1', error: null });
      expect(mockFrom).toHaveBeenCalledWith('signal_leads');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          linkedin_url: 'https://www.linkedin.com/in/janedoe',
          first_name: 'Jane',
          last_name: 'Doe',
          headline: 'CEO at Acme',
        }),
        { onConflict: 'user_id,linkedin_url' }
      );
    });

    it('normalizes the linkedin_url before upserting', async () => {
      await upsertSignalLead({
        user_id: 'user-1',
        linkedin_url: 'https://www.LinkedIn.com/in/JaneDoe/?ref=123',
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          linkedin_url: 'https://www.linkedin.com/in/janedoe',
        }),
        expect.any(Object)
      );
    });

    it('sets missing optional fields to null', async () => {
      await upsertSignalLead({
        user_id: 'user-1',
        linkedin_url: 'https://www.linkedin.com/in/janedoe',
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: null,
          last_name: null,
          headline: null,
          job_title: null,
          company: null,
          country: null,
        }),
        expect.any(Object)
      );
    });

    it('includes updated_at timestamp', async () => {
      await upsertSignalLead({
        user_id: 'user-1',
        linkedin_url: 'https://www.linkedin.com/in/janedoe',
      });

      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg.updated_at).toBeDefined();
      // Should be a valid ISO string
      expect(new Date(upsertArg.updated_at).toISOString()).toBe(upsertArg.updated_at);
    });

    it('returns error when upsert fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'upsert failed' } });

      const result = await upsertSignalLead({
        user_id: 'user-1',
        linkedin_url: 'https://www.linkedin.com/in/janedoe',
      });

      expect(result).toEqual({ id: null, error: 'upsert failed' });
      expect(logError).toHaveBeenCalledWith(
        'services/signal-engine',
        expect.any(Error),
        expect.objectContaining({ detail: 'upsert failed' })
      );
    });
  });

  // ----------------------------------------------------------------
  // recordSignalEvent
  // ----------------------------------------------------------------
  describe('recordSignalEvent', () => {
    it('inserts into signal_events with correct params', async () => {
      const result = await recordSignalEvent({
        user_id: 'user-1',
        lead_id: 'lead-1',
        signal_type: 'keyword_engagement',
        source_url: 'https://linkedin.com/post/123',
        comment_text: 'Great post!',
        engagement_type: 'comment',
      });

      expect(result).toEqual({ error: null });
      expect(mockFrom).toHaveBeenCalledWith('signal_events');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          lead_id: 'lead-1',
          signal_type: 'keyword_engagement',
          source_url: 'https://linkedin.com/post/123',
          comment_text: 'Great post!',
          engagement_type: 'comment',
        })
      );
    });

    it('includes detected_at timestamp', async () => {
      await recordSignalEvent({
        user_id: 'user-1',
        lead_id: 'lead-1',
        signal_type: 'job_change',
      });

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.detected_at).toBeDefined();
      expect(new Date(insertArg.detected_at).toISOString()).toBe(insertArg.detected_at);
    });

    it('sets missing optional fields to null', async () => {
      await recordSignalEvent({
        user_id: 'user-1',
        lead_id: 'lead-1',
        signal_type: 'job_change',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_url: null,
          source_monitor_id: null,
          comment_text: null,
          sentiment: null,
          keyword_matched: null,
          engagement_type: null,
          metadata: {},
        })
      );
    });

    it('returns error when insert fails', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'insert failed' } });

      const result = await recordSignalEvent({
        user_id: 'user-1',
        lead_id: 'lead-1',
        signal_type: 'keyword_engagement',
      });

      expect(result).toEqual({ error: 'insert failed' });
      expect(logError).toHaveBeenCalledWith(
        'services/signal-engine',
        expect.any(Error),
        expect.objectContaining({ detail: 'insert failed' })
      );
    });
  });

  // ----------------------------------------------------------------
  // updateSignalCounts
  // ----------------------------------------------------------------
  describe('updateSignalCounts', () => {
    it('computes correct score for a single keyword_engagement event', async () => {
      // Mock select chain for fetching events
      const mockSelectEvents = jest.fn();
      const mockEqUserId = jest.fn();
      const mockEqLeadId = jest.fn();

      mockEqLeadId.mockResolvedValue({
        data: [
          { signal_type: 'keyword_engagement', sentiment: null },
        ],
        error: null,
      });
      mockEqUserId.mockReturnValue({ eq: mockEqLeadId });
      mockSelectEvents.mockReturnValue({ eq: mockEqUserId });

      // Mock update chain
      const mockUpdateFn = jest.fn();
      const mockUpdateEq1 = jest.fn();
      const mockUpdateEq2 = jest.fn();
      mockUpdateEq2.mockResolvedValue({ error: null });
      mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
      mockUpdateFn.mockReturnValue({ eq: mockUpdateEq1 });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: select events
          return { select: mockSelectEvents };
        }
        // Second call: update lead
        return { update: mockUpdateFn };
      });

      await updateSignalCounts('user-1', 'lead-1');

      // Should update with signal_count=1, compound_score=15 (keyword_engagement weight)
      expect(mockUpdateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          signal_count: 1,
          compound_score: 15,
          sentiment_score: null,
        })
      );
    });

    it('computes compound score with multiple signal types and sentiment bonus', async () => {
      const mockSelectEvents = jest.fn();
      const mockEqUserId = jest.fn();
      const mockEqLeadId = jest.fn();

      mockEqLeadId.mockResolvedValue({
        data: [
          { signal_type: 'keyword_engagement', sentiment: 'high_intent' },
          { signal_type: 'job_change', sentiment: null },
          { signal_type: 'keyword_engagement', sentiment: 'question' },
        ],
        error: null,
      });
      mockEqUserId.mockReturnValue({ eq: mockEqLeadId });
      mockSelectEvents.mockReturnValue({ eq: mockEqUserId });

      const mockUpdateFn = jest.fn();
      const mockUpdateEq1 = jest.fn();
      const mockUpdateEq2 = jest.fn();
      mockUpdateEq2.mockResolvedValue({ error: null });
      mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
      mockUpdateFn.mockReturnValue({ eq: mockUpdateEq1 });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: mockSelectEvents };
        return { update: mockUpdateFn };
      });

      await updateSignalCounts('user-1', 'lead-1');

      // keyword_engagement=15 + job_change=30 = 45 base
      // high_intent bonus=20, question bonus=15 -> total=80
      // 2 distinct types
      expect(mockUpdateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          signal_count: 2,
          compound_score: 80,
          sentiment_score: 'high_intent', // highest rank
        })
      );
    });

    it('caps compound score at 100', async () => {
      const mockSelectEvents = jest.fn();
      const mockEqUserId = jest.fn();
      const mockEqLeadId = jest.fn();

      // Create enough events to exceed 100
      mockEqLeadId.mockResolvedValue({
        data: [
          { signal_type: 'job_change', sentiment: 'high_intent' },        // 30 + 20 = 50
          { signal_type: 'job_posting', sentiment: 'high_intent' },       // 20 + 20 = 40
          { signal_type: 'keyword_engagement', sentiment: 'high_intent' }, // 15 + 20 = 35
          // Total: 50 + 40 + 35 = 125, should cap at 100
        ],
        error: null,
      });
      mockEqUserId.mockReturnValue({ eq: mockEqLeadId });
      mockSelectEvents.mockReturnValue({ eq: mockEqUserId });

      const mockUpdateFn = jest.fn();
      const mockUpdateEq1 = jest.fn();
      const mockUpdateEq2 = jest.fn();
      mockUpdateEq2.mockResolvedValue({ error: null });
      mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
      mockUpdateFn.mockReturnValue({ eq: mockUpdateEq1 });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: mockSelectEvents };
        return { update: mockUpdateFn };
      });

      await updateSignalCounts('user-1', 'lead-1');

      expect(mockUpdateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          compound_score: 100,
        })
      );
    });

    it('does not update when no events found', async () => {
      const mockSelectEvents = jest.fn();
      const mockEqUserId = jest.fn();
      const mockEqLeadId = jest.fn();

      mockEqLeadId.mockResolvedValue({ data: [], error: null });
      mockEqUserId.mockReturnValue({ eq: mockEqLeadId });
      mockSelectEvents.mockReturnValue({ eq: mockEqUserId });

      mockFrom.mockReturnValue({ select: mockSelectEvents });

      await updateSignalCounts('user-1', 'lead-1');

      // from() called only once for select, never for update
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('logs error when event fetch fails', async () => {
      const mockSelectEvents = jest.fn();
      const mockEqUserId = jest.fn();
      const mockEqLeadId = jest.fn();

      mockEqLeadId.mockResolvedValue({ data: null, error: { message: 'fetch failed' } });
      mockEqUserId.mockReturnValue({ eq: mockEqLeadId });
      mockSelectEvents.mockReturnValue({ eq: mockEqUserId });

      mockFrom.mockReturnValue({ select: mockSelectEvents });

      await updateSignalCounts('user-1', 'lead-1');

      expect(logError).toHaveBeenCalledWith(
        'services/signal-engine',
        expect.any(Error),
        expect.objectContaining({ detail: 'fetch failed' })
      );
    });
  });

  // ----------------------------------------------------------------
  // processEngagers
  // ----------------------------------------------------------------
  describe('processEngagers', () => {
    it('processes a batch of engagers successfully', async () => {
      // Wire: upsert -> select -> single for lead, insert for event
      // We need to handle two from() calls per engager: one for upsert, one for insert
      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx % 2 === 1) {
          // Upsert call
          return {
            upsert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: `lead-${callIdx}` },
                  error: null,
                }),
              }),
            }),
          };
        }
        // Insert call
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      const result = await processEngagers({
        userId: 'user-1',
        signalType: 'keyword_engagement',
        sourceUrl: 'https://linkedin.com/post/123',
        keywordMatched: 'agency',
        engagers: [
          {
            linkedinUrl: 'https://www.linkedin.com/in/alice',
            name: 'Alice Smith',
            commentText: 'Great insight!',
            engagementType: 'comment',
          },
          {
            linkedinUrl: 'https://www.linkedin.com/in/bob',
            name: 'Bob',
            engagementType: 'reaction',
          },
        ],
      });

      expect(result.processed).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('skips engagers without linkedinUrl', async () => {
      const result = await processEngagers({
        userId: 'user-1',
        signalType: 'keyword_engagement',
        sourceUrl: 'https://linkedin.com/post/123',
        engagers: [
          {
            linkedinUrl: '',
            name: 'No URL Person',
            engagementType: 'reaction',
          },
        ],
      });

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
      // Should not have called from() at all
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('collects errors when upsert fails for an engager', async () => {
      mockFrom.mockImplementation(() => ({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'upsert error' },
            }),
          }),
        }),
      }));

      const result = await processEngagers({
        userId: 'user-1',
        signalType: 'keyword_engagement',
        sourceUrl: 'https://linkedin.com/post/123',
        engagers: [
          {
            linkedinUrl: 'https://www.linkedin.com/in/alice',
            name: 'Alice',
            engagementType: 'comment',
          },
        ],
      });

      expect(result.processed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Upsert failed');
    });

    it('collects errors when event recording fails', async () => {
      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx % 2 === 1) {
          return {
            upsert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'lead-1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ error: { message: 'event insert failed' } }),
        };
      });

      const result = await processEngagers({
        userId: 'user-1',
        signalType: 'keyword_engagement',
        sourceUrl: 'https://linkedin.com/post/123',
        engagers: [
          {
            linkedinUrl: 'https://www.linkedin.com/in/alice',
            name: 'Alice',
            engagementType: 'comment',
          },
        ],
      });

      expect(result.processed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Event failed');
    });

    it('continues processing after one engager fails', async () => {
      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          // First engager upsert fails
          return {
            upsert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'upsert error' },
                }),
              }),
            }),
          };
        }
        if (callIdx === 2) {
          // Second engager upsert succeeds
          return {
            upsert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'lead-2' },
                  error: null,
                }),
              }),
            }),
          };
        }
        // Second engager event insert succeeds
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      const result = await processEngagers({
        userId: 'user-1',
        signalType: 'keyword_engagement',
        sourceUrl: 'https://linkedin.com/post/123',
        engagers: [
          {
            linkedinUrl: 'https://www.linkedin.com/in/alice',
            name: 'Alice',
            engagementType: 'comment',
          },
          {
            linkedinUrl: 'https://www.linkedin.com/in/bob',
            name: 'Bob',
            engagementType: 'reaction',
          },
        ],
      });

      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('handles engager with empty name', async () => {
      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx % 2 === 1) {
          return {
            upsert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'lead-1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      const result = await processEngagers({
        userId: 'user-1',
        signalType: 'keyword_engagement',
        sourceUrl: 'https://linkedin.com/post/123',
        engagers: [
          {
            linkedinUrl: 'https://www.linkedin.com/in/unknown',
            name: '',
            engagementType: 'reaction',
          },
        ],
      });

      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('catches and records exceptions', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const result = await processEngagers({
        userId: 'user-1',
        signalType: 'keyword_engagement',
        sourceUrl: 'https://linkedin.com/post/123',
        engagers: [
          {
            linkedinUrl: 'https://www.linkedin.com/in/alice',
            name: 'Alice',
            engagementType: 'comment',
          },
        ],
      });

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Exception');
      expect(result.errors[0]).toContain('Unexpected crash');
    });
  });
});
