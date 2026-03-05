/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock next/headers cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(undefined),
  }),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock cp-transcripts service
const mockList = jest.fn();
const mockCreateFromPaste = jest.fn();

jest.mock('@/server/services/cp-transcripts.service', () => ({
  list: (...args: unknown[]) => mockList(...args),
  createFromPaste: (...args: unknown[]) => mockCreateFromPaste(...args),
  deleteTranscript: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { GET, POST } from '@/app/api/content-pipeline/transcripts/route';

describe('Content Pipeline — Transcripts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      mockList.mockResolvedValue({ success: true, transcripts });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/transcripts');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.transcripts).toHaveLength(2);
      expect(data.transcripts[0].id).toBe('tx-1');
      expect(data.transcripts[1].id).toBe('tx-2');

      expect(mockList).toHaveBeenCalledWith('user-1', null, null, 50);
    });

    it('should return empty array when user has no transcripts', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-new' } });
      mockList.mockResolvedValue({ success: true, transcripts: [] });

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

      mockCreateFromPaste.mockResolvedValue({
        success: true,
        transcript_id: 'tx-new',
      });

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
    });

    it('should return 500 when service fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      mockCreateFromPaste.mockResolvedValue({
        success: false,
        error: 'DB error',
      });

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
