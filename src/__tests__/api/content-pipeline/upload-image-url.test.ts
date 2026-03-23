/**
 * @jest-environment node
 */

import { POST } from '@/app/api/content-pipeline/posts/[id]/upload-image-url/route';
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

// Mock global fetch for URL downloads
global.fetch = jest.fn();

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function createJsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/content-pipeline/posts/post-1/upload-image-url',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function createImageFetchResponse(contentType: string, sizeBytes: number, status = 200): Response {
  const buffer = new ArrayBuffer(sizeBytes);
  return new Response(buffer, {
    status,
    headers: { 'content-type': contentType },
  });
}

function createMockSupabaseWithStorage() {
  const uploadMock = jest.fn().mockResolvedValue({ error: null });
  const getPublicUrlMock = jest.fn().mockReturnValue({
    data: { publicUrl: 'https://storage.supabase.co/post-images/user-1/post-1/image.png' },
  });
  const updateMock = jest.fn();
  const eqMock = jest.fn();

  const dbChain = {
    update: updateMock,
    eq: eqMock,
  };
  updateMock.mockReturnValue(dbChain);
  eqMock.mockReturnValue(dbChain);

  Object.defineProperty(dbChain, 'then', {
    value: (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => {
      return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
    },
    enumerable: false,
  });

  const client = {
    storage: {
      from: jest.fn().mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
    from: jest.fn().mockReturnValue(dbChain),
  };

  return { client, uploadMock, getPublicUrlMock, updateMock, eqMock };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/content-pipeline/posts/[id]/upload-image-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = createJsonRequest({ image_url: 'https://example.com/image.png' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when image_url is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const request = createJsonRequest({});
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('image_url');
  });

  it('should return 400 for invalid URL', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const request = createJsonRequest({ image_url: 'not-a-url' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('valid URL');
  });

  it('should return 400 when remote server returns non-200', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(createImageFetchResponse('image/png', 1024, 404));

    const request = createJsonRequest({ image_url: 'https://example.com/missing.png' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('404');
  });

  it('should return 400 for non-image content type', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(
      createImageFetchResponse('application/pdf', 1024)
    );

    const request = createJsonRequest({ image_url: 'https://example.com/doc.pdf' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Invalid file type');
  });

  it('should return 400 for image exceeding 10MB', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(
      createImageFetchResponse('image/png', 11 * 1024 * 1024)
    );

    const request = createJsonRequest({ image_url: 'https://example.com/huge.png' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('File too large');
  });

  it('should download, upload, and return imageUrl + storagePath for valid PNG', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(createImageFetchResponse('image/png', 5000));

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = createJsonRequest({ image_url: 'https://example.com/photo.png' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.imageUrl).toBe('https://storage.supabase.co/post-images/user-1/post-1/image.png');
    expect(data.storagePath).toBe('user-1/post-1/photo.png');

    // Verify storage upload
    expect(mock.client.storage.from).toHaveBeenCalledWith('post-images');
    expect(mock.uploadMock).toHaveBeenCalledWith('user-1/post-1/photo.png', expect.any(Buffer), {
      contentType: 'image/png',
      upsert: true,
    });

    // Verify DB update
    expect(mock.client.from).toHaveBeenCalledWith('cp_pipeline_posts');
    expect(mock.updateMock).toHaveBeenCalledWith({
      image_storage_path: 'user-1/post-1/photo.png',
    });
  });

  it('should accept webp image URLs', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(createImageFetchResponse('image/webp', 2000));

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = createJsonRequest({ image_url: 'https://cdn.example.com/banner.webp' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.storagePath).toBe('user-1/post-1/banner.webp');
  });

  it('should accept gif image URLs', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(createImageFetchResponse('image/gif', 3000));

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = createJsonRequest({
      image_url: 'https://example.com/animation.gif',
    });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
  });

  it('should return 500 when storage upload fails', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(createImageFetchResponse('image/png', 1024));

    const mock = createMockSupabaseWithStorage();
    mock.uploadMock.mockResolvedValue({ error: { message: 'Bucket not found' } });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = createJsonRequest({ image_url: 'https://example.com/photo.png' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to upload image');
  });

  it('should return 500 when fetch throws (network error)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network timeout'));

    const request = createJsonRequest({ image_url: 'https://example.com/photo.png' });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to fetch image');
  });

  it('should fallback filename to mime type extension for URLs with no extension', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (global.fetch as jest.Mock).mockResolvedValue(createImageFetchResponse('image/jpeg', 2000));

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = createJsonRequest({
      image_url: 'https://example.com/getimage?id=123',
    });
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
    // Filename has no extension in path — falls back to mime extension
    const data = await response.json();
    expect(data.storagePath).toMatch(/^user-1\/post-1\//);
  });
});
