/**
 * @jest-environment node
 */

import { POST } from '@/app/api/content-pipeline/posts/[id]/upload-image/route';
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

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function createMockFile(name: string, type: string, sizeBytes: number): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

function createUploadRequest(file?: File): NextRequest {
  const formData = new FormData();
  if (file) {
    formData.append('image', file);
  }
  return new NextRequest('http://localhost:3000/api/content-pipeline/posts/post-1/upload-image', {
    method: 'POST',
    body: formData,
  });
}

function createMockSupabaseWithStorage() {
  const uploadMock = jest.fn().mockResolvedValue({ error: null });
  const getPublicUrlMock = jest.fn().mockReturnValue({
    data: { publicUrl: 'https://storage.supabase.co/post-images/user-1/post-1/image.png' },
  });
  const updateMock = jest.fn();
  const eqMock = jest.fn();

  // Chain for .from('cp_pipeline_posts').update().eq().eq()
  const dbChain = {
    update: updateMock,
    eq: eqMock,
  };
  updateMock.mockReturnValue(dbChain);
  eqMock.mockReturnValue(dbChain);

  // Make the chain thenable (resolves to success)
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

  return {
    client,
    uploadMock,
    getPublicUrlMock,
    updateMock,
    eqMock,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/content-pipeline/posts/[id]/upload-image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const file = createMockFile('image.png', 'image/png', 1024);
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when no file is provided', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const request = createUploadRequest(); // No file
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('No image file provided');
  });

  it('should return 400 for non-image file type', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const file = createMockFile('document.pdf', 'application/pdf', 1024);
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Invalid file type');
  });

  it('should return 400 for file exceeding 10MB', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const file = createMockFile('large.png', 'image/png', 11 * 1024 * 1024); // 11MB
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('File too large');
  });

  it('should upload valid image and return imageUrl + storagePath', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const file = createMockFile('photo.png', 'image/png', 5000);
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.imageUrl).toBe('https://storage.supabase.co/post-images/user-1/post-1/image.png');
    expect(data.storagePath).toBe('user-1/post-1/photo.png');

    // Verify storage upload was called
    expect(mock.client.storage.from).toHaveBeenCalledWith('post-images');
    expect(mock.uploadMock).toHaveBeenCalledWith('user-1/post-1/photo.png', expect.any(Buffer), {
      contentType: 'image/png',
      upsert: true,
    });

    // Verify DB update was called
    expect(mock.client.from).toHaveBeenCalledWith('cp_pipeline_posts');
    expect(mock.updateMock).toHaveBeenCalledWith({ image_storage_path: 'user-1/post-1/photo.png' });
  });

  it('should accept webp images', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const file = createMockFile('photo.webp', 'image/webp', 2000);
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.storagePath).toBe('user-1/post-1/photo.webp');
  });

  it('should accept gif images', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const file = createMockFile('animation.gif', 'image/gif', 3000);
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
  });

  it('should return 500 when storage upload fails', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const mock = createMockSupabaseWithStorage();
    mock.uploadMock.mockResolvedValue({ error: { message: 'Bucket not found' } });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const file = createMockFile('photo.png', 'image/png', 1024);
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to upload image');
  });

  it('should accept jpeg images', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const mock = createMockSupabaseWithStorage();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const file = createMockFile('photo.jpeg', 'image/jpeg', 4000);
    const request = createUploadRequest(file);
    const response = await POST(request, createMockParams('post-1'));

    expect(response.status).toBe(200);
  });
});
