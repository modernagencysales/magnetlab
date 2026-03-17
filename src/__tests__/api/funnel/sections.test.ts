/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock team-context — route uses getScopeForResource
jest.mock('@/lib/utils/team-context', () => ({
  getScopeForResource: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
}));

// Mock funnels repo — route calls getFunnelTeamId
jest.mock('@/server/repositories/funnels.repo', () => ({
  getFunnelTeamId: jest.fn(() => Promise.resolve(null)),
}));

// Mock API errors
jest.mock('@/lib/api/errors', () => ({
  ApiErrors: {
    unauthorized: jest.fn(
      () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    ),
  },
}));

// Mock funnels service
const mockGetSections = jest.fn();
const mockCreateSection = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);

jest.mock('@/server/services/funnels.service', () => ({
  getSections: (...args: unknown[]) => mockGetSections(...args),
  createSection: (...args: unknown[]) => mockCreateSection(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

import { GET, POST } from '@/app/api/funnel/[id]/sections/route';
import { auth } from '@/lib/auth';

describe('Sections API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/funnel/[id]/sections', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/funnel/f1/sections');
      const response = await GET(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 when funnel not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const err = Object.assign(new Error('Funnel page not found'), { statusCode: 404 });
      mockGetSections.mockRejectedValue(err);
      mockGetStatusCode.mockReturnValue(404);

      const request = new Request('http://localhost/api/funnel/f1/sections');
      const response = await GET(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(404);
    });

    it('should return sections when authenticated and funnel exists', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mockGetSections.mockResolvedValue([
        {
          id: 's1',
          funnelPageId: 'f1',
          sectionType: 'testimonial',
          pageLocation: 'optin',
          sortOrder: 10,
          isVisible: true,
          config: { quote: 'Great!' },
          createdAt: '2026-01-29T00:00:00Z',
          updatedAt: '2026-01-29T00:00:00Z',
        },
      ]);

      const request = new Request('http://localhost/api/funnel/f1/sections');
      const response = await GET(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.sections).toHaveLength(1);
      expect(body.sections[0].sectionType).toBe('testimonial');
      expect(body.sections[0].config).toEqual({ quote: 'Great!' });
    });
  });

  describe('POST /api/funnel/[id]/sections', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/funnel/f1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'testimonial',
          pageLocation: 'optin',
          config: { quote: 'Test' },
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid section type', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const err = Object.assign(new Error('Invalid section type'), { statusCode: 400 });
      mockCreateSection.mockRejectedValue(err);
      mockGetStatusCode.mockReturnValue(400);

      const request = new Request('http://localhost/api/funnel/f1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'invalid',
          pageLocation: 'optin',
          config: {},
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid page location', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const err = Object.assign(new Error('Invalid page location'), { statusCode: 400 });
      mockCreateSection.mockRejectedValue(err);
      mockGetStatusCode.mockReturnValue(400);

      const request = new Request('http://localhost/api/funnel/f1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'testimonial',
          pageLocation: 'bogus',
          config: { quote: 'Test' },
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(400);
    });
  });
});
