/**
 * @jest-environment node
 */

import { GET } from '@/app/api/content-pipeline/trends/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock trends service
jest.mock('@/server/services/trends.service', () => ({
  getTrendingTopics: jest.fn(),
  getStatusCode: jest.fn((err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      return (err as { statusCode: number }).statusCode;
    }
    return 500;
  }),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { getTrendingTopics } from '@/server/services/trends.service';

const MOCK_TOPICS = [
  { topic: 'ai', count: 15, confidence: 'high', trend: 'stable' },
  { topic: 'marketing', count: 7, confidence: 'medium', trend: 'stable' },
  { topic: 'cold email', count: 2, confidence: 'low', trend: 'stable' },
];

describe('Content Pipeline — Trends API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/content-pipeline/trends', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 when session exists but user.id is missing', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: {} });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('returns trending topics with 200', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (getTrendingTopics as jest.Mock).mockResolvedValue(MOCK_TOPICS);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.topics).toHaveLength(3);
      expect(data.topics[0].topic).toBe('ai');
      expect(data.topics[0].count).toBe(15);
      expect(data.topics[0].confidence).toBe('high');
      expect(data.topics[0].trend).toBe('stable');
    });

    it('returns empty array when no topics exist', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (getTrendingTopics as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.topics).toHaveLength(0);
    });

    it('uses default limit=10 when no limit param provided', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (getTrendingTopics as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends');
      await GET(request);

      expect(getTrendingTopics).toHaveBeenCalledWith('user-1', 10);
    });

    it('parses the limit query param', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (getTrendingTopics as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends?limit=25');
      await GET(request);

      expect(getTrendingTopics).toHaveBeenCalledWith('user-1', 25);
    });

    it('clamps limit to min=1 for invalid low values', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (getTrendingTopics as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends?limit=0');
      await GET(request);

      expect(getTrendingTopics).toHaveBeenCalledWith('user-1', 1);
    });

    it('clamps limit to max=100', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (getTrendingTopics as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/trends?limit=500'
      );
      await GET(request);

      expect(getTrendingTopics).toHaveBeenCalledWith('user-1', 100);
    });

    it('returns 500 when service throws', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (getTrendingTopics as jest.Mock).mockRejectedValue(
        Object.assign(new Error('DB failure'), { statusCode: 500 })
      );

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/trends');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
