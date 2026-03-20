/**
 * @jest-environment node
 */
/**
 * Content Queue Image Upload Route Tests.
 * Tests POST /api/content-queue/posts/[id]/upload-image.
 * Validates auth, file presence check, and delegation to service layer.
 */
import { NextRequest } from 'next/server';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockUploadQueuePostImage = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  uploadQueuePostImage: (...args: unknown[]) => mockUploadQueuePostImage(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Import handler after mocks ─────────────────────────────────────────────

import { POST } from '@/app/api/content-queue/posts/[id]/upload-image/route';

// ─── Helpers ────────────────────────────────────────────────────────────────

const params = Promise.resolve({ id: 'post-1' });

function makeUploadRequest(file?: File) {
  const formData = new FormData();
  if (file) formData.append('image', file);
  return new NextRequest('http://localhost/api/content-queue/posts/post-1/upload-image', {
    method: 'POST',
    body: formData,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/content-queue/posts/[id]/upload-image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const file = new File([Buffer.from('fake-png')], 'test.png', { type: 'image/png' });
    const res = await POST(makeUploadRequest(file), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing image file', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await POST(makeUploadRequest(), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no image file/i);
  });

  it('returns 403 when service throws access error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const err = Object.assign(new Error('Post not found or not accessible'), { statusCode: 403 });
    mockUploadQueuePostImage.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(403);

    const file = new File([Buffer.from('fake-png')], 'test.png', { type: 'image/png' });
    const res = await POST(makeUploadRequest(file), { params });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid file type (service validation)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const err = Object.assign(new Error('Invalid file type: application/x-msdownload'), {
      statusCode: 400,
    });
    mockUploadQueuePostImage.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(400);

    const file = new File([Buffer.from('not-an-image')], 'malware.exe', {
      type: 'application/x-msdownload',
    });
    const res = await POST(makeUploadRequest(file), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid file type/i);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockUploadQueuePostImage.mockRejectedValue(new Error('Storage failure'));
    mockGetStatusCode.mockReturnValue(500);

    const file = new File([Buffer.from('fake-png-data')], 'hero.png', { type: 'image/png' });
    const res = await POST(makeUploadRequest(file), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('returns 200 with imageUrl and storagePath on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockUploadQueuePostImage.mockResolvedValue({
      imageUrl: 'https://storage.example.com/post-images/user-1/post-1/abc123.png',
      storagePath: 'user-1/post-1/abc123.png',
    });

    const file = new File([Buffer.from('fake-png-data')], 'hero.png', { type: 'image/png' });
    const res = await POST(makeUploadRequest(file), { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.imageUrl).toBe('https://storage.example.com/post-images/user-1/post-1/abc123.png');
    expect(body.storagePath).toBe('user-1/post-1/abc123.png');
  });

  it('passes correct arguments to service', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockUploadQueuePostImage.mockResolvedValue({
      imageUrl: 'https://example.com/image.png',
      storagePath: 'user-1/post-1/uuid.png',
    });

    const file = new File([Buffer.from('png-data')], 'photo.png', { type: 'image/png' });
    await POST(makeUploadRequest(file), { params });

    expect(mockUploadQueuePostImage).toHaveBeenCalledWith('user-1', 'post-1', {
      buffer: expect.any(Buffer),
      type: 'image/png',
      name: 'photo.png',
    });
  });
});
