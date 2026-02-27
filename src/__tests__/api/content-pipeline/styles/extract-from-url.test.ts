/**
 * @jest-environment node
 */

// Mock auth — default to authenticated
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

// Mock Harvest API
jest.mock('@/lib/integrations/harvest-api', () => ({
  getProfilePosts: jest.fn(),
}));

// Mock style extractor
jest.mock('@/lib/ai/style-extractor', () => ({
  extractWritingStyle: jest.fn(),
}));

// Mock embeddings
jest.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(null),
}));

// Mock Supabase
const mockSingle = jest.fn();
const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/content-pipeline/styles/extract-from-url/route';
import { auth } from '@/lib/auth';
import { getProfilePosts } from '@/lib/integrations/harvest-api';
import { extractWritingStyle } from '@/lib/ai/style-extractor';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-pipeline/styles/extract-from-url', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makePost(index: number) {
  return {
    id: `post-${index}`,
    linkedinUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${index}`,
    content: `This is a long enough post text that exceeds fifty characters for testing purposes. Post number ${index}.`,
    name: 'Jane Doe',
    engagement: { likes: 10, comments: 5 },
    postedAt: { timestamp: 1735689600, date: '2026-01-01T00:00:00Z' },
  };
}

const MOCK_EXTRACTED_STYLE = {
  name: 'Direct Educator',
  description: 'A clear, instructional tone with actionable insights.',
  style_profile: {
    tone: 'educational' as const,
    sentence_length: 'medium' as const,
    vocabulary: 'mixed' as const,
    formatting: {
      uses_emojis: false,
      uses_line_breaks: true,
      uses_lists: true,
      uses_bold: false,
      avg_paragraphs: 4,
    },
    hook_patterns: ['Start with a bold claim', 'Ask a question'],
    cta_patterns: ['Follow for more', 'Drop a comment'],
    banned_phrases: ['game-changer'],
    signature_phrases: ['Here is the thing'],
  },
  example_posts: ['Example post 1', 'Example post 2'],
  key_patterns: ['Uses numbered lists', 'Opens with hook'],
  recommendations: ['Vary sentence length', 'Add more CTAs'],
};

describe('POST /api/content-pipeline/styles/extract-from-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset auth to default authenticated state
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns 401 if not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ linkedin_url: 'https://www.linkedin.com/in/janedoe' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 if linkedin_url is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('linkedin_url');
  });

  it('returns 400 if URL is not a LinkedIn domain', async () => {
    const res = await POST(makeRequest({ linkedin_url: 'https://evil.com/in/janedoe' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('LinkedIn');
  });

  it('returns 502 if Harvest scrape returns error', async () => {
    (getProfilePosts as jest.Mock).mockResolvedValueOnce({
      data: [],
      error: 'Harvest HTTP 500: Internal error',
    });

    const res = await POST(makeRequest({ linkedin_url: 'https://www.linkedin.com/in/janedoe' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('Failed to scrape');
  });

  it('returns 422 if fewer than 3 text posts found', async () => {
    // Return 2 posts with text > 50 chars and 1 with short text
    const posts = [makePost(1), makePost(2), { ...makePost(3), content: 'Short' }];
    (getProfilePosts as jest.Mock).mockResolvedValueOnce({
      data: posts,
      error: null,
    });

    const res = await POST(makeRequest({ linkedin_url: 'https://www.linkedin.com/in/janedoe' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain('Only found 2 text posts');
  });

  it('returns 201 with extracted style on success', async () => {
    const posts = [makePost(1), makePost(2), makePost(3), makePost(4), makePost(5)];
    (getProfilePosts as jest.Mock).mockResolvedValueOnce({
      data: posts,
      error: null,
    });
    (extractWritingStyle as jest.Mock).mockResolvedValueOnce(MOCK_EXTRACTED_STYLE);
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'style-1',
        user_id: 'user-1',
        name: 'Direct Educator',
        description: 'A clear, instructional tone with actionable insights.',
        source_linkedin_url: 'https://www.linkedin.com/in/janedoe',
        source_posts_analyzed: 5,
        style_profile: MOCK_EXTRACTED_STYLE.style_profile,
        example_posts: MOCK_EXTRACTED_STYLE.example_posts,
        is_active: true,
        last_updated_at: null,
        created_at: '2026-02-23T00:00:00Z',
      },
      error: null,
    });

    const res = await POST(makeRequest({ linkedin_url: 'https://www.linkedin.com/in/janedoe' }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.style).toBeDefined();
    expect(body.style.id).toBe('style-1');
    expect(body.style.name).toBe('Direct Educator');
    expect(body.key_patterns).toEqual(MOCK_EXTRACTED_STYLE.key_patterns);
    expect(body.recommendations).toEqual(MOCK_EXTRACTED_STYLE.recommendations);
    expect(body.posts_analyzed).toBe(5);

    // Verify extractWritingStyle was called with correct shape
    expect(extractWritingStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        posts: expect.arrayContaining([expect.any(String)]),
      })
    );
  });
});
