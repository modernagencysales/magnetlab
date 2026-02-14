/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/content-pipeline/transcripts/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock Trigger.dev tasks
jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: jest.fn(() => Promise.resolve()),
  },
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client with chainable methods.
 * Tracks from() calls and routes to different result sets by table name.
 */
function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown };

  const tableResults: Record<string, TableResult> = {};
  const singleResults: Record<string, TableResult[]> = {};
  const singleCallIndex: Record<string, number> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.delete = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.in = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);

    chain.single = jest.fn(() => {
      if (singleResults[tableName] && singleResults[tableName].length > 0) {
        const idx = singleCallIndex[tableName] || 0;
        singleCallIndex[tableName] = idx + 1;
        return Promise.resolve(singleResults[tableName][idx] || { data: null, error: null });
      }
      return Promise.resolve(tableResults[tableName] || { data: null, error: null });
    });

    // Make the chain thenable so `await query` resolves
    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = tableResults[tableName] || { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      enumerable: false,
    });

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => createChain(table)),
  };

  return {
    client,
    setTableResult: (table: string, result: TableResult) => {
      tableResults[table] = result;
    },
    setSingleResults: (table: string, results: TableResult[]) => {
      singleResults[table] = results;
      singleCallIndex[table] = 0;
    },
    reset: () => {
      Object.keys(tableResults).forEach(k => delete tableResults[k]);
      Object.keys(singleResults).forEach(k => delete singleResults[k]);
      Object.keys(singleCallIndex).forEach(k => delete singleCallIndex[k]);
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

describe('Content Pipeline — Transcripts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  describe('GET /api/content-pipeline/transcripts', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should list user transcripts', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const transcripts = [
        {
          id: 'tx-1',
          source: 'paste',
          title: 'Sales Call Jan 15',
          call_date: null,
          duration_minutes: null,
          transcript_type: null,
          ideas_extracted_at: null,
          knowledge_extracted_at: null,
          team_id: null,
          speaker_profile_id: null,
          created_at: '2026-02-14T00:00:00Z',
        },
        {
          id: 'tx-2',
          source: 'grain',
          title: 'Discovery Call',
          call_date: '2026-02-10',
          duration_minutes: 30,
          transcript_type: 'call',
          ideas_extracted_at: '2026-02-11T00:00:00Z',
          knowledge_extracted_at: '2026-02-11T00:00:00Z',
          team_id: null,
          speaker_profile_id: null,
          created_at: '2026-02-10T00:00:00Z',
        },
      ];

      mock.setTableResult('cp_call_transcripts', { data: transcripts, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.transcripts).toHaveLength(2);
      expect(data.transcripts[0].id).toBe('tx-1');
      expect(data.transcripts[1].id).toBe('tx-2');

      // Verify it queries the correct table
      expect(mock.client.from).toHaveBeenCalledWith('cp_call_transcripts');
    });

    it('should return empty array when user has no transcripts', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-new' } });
      mock.setTableResult('cp_call_transcripts', { data: [], error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.transcripts).toHaveLength(0);
    });
  });

  describe('POST /api/content-pipeline/transcripts', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: 'A'.repeat(200) }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when transcript is too short', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: 'Too short' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('at least 100 characters');
    });

    it('should create a transcript record successfully', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const transcriptText = 'A'.repeat(200);

      // Mock team lookup (user owns no team)
      mock.setSingleResults('teams', [
        { data: { id: 'team-1' }, error: null },
      ]);

      // Mock insert
      mock.setSingleResults('cp_call_transcripts', [
        {
          data: {
            id: 'tx-new',
            user_id: 'user-1',
            source: 'paste',
            title: 'Pasted Transcript',
            raw_transcript: transcriptText,
          },
          error: null,
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          title: 'My Call',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.transcript_id).toBe('tx-new');

      // Verify it inserts into correct table
      expect(mock.client.from).toHaveBeenCalledWith('cp_call_transcripts');
    });

    it('should return 500 when database insert fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      mock.setSingleResults('teams', [
        { data: null, error: null },
      ]);

      mock.setSingleResults('cp_call_transcripts', [
        {
          data: null,
          error: { message: 'DB error', code: '500' },
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: 'A'.repeat(200),
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to save transcript');
    });
  });
});
