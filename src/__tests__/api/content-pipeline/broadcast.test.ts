/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Trigger.dev tasks
jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { POST } from '@/app/api/content-pipeline/broadcast/route';
import { auth } from '@/lib/auth';
import { tasks } from '@trigger.dev/sdk/v3';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockTrigger = tasks.trigger as jest.Mock;

function createBroadcastRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/content-pipeline/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/content-pipeline/broadcast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: ['profile-1'],
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 if source_post_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      target_profile_ids: ['profile-1'],
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('source_post_id');
  });

  it('returns 400 if target_profile_ids is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('target_profile_ids');
  });

  it('returns 400 if target_profile_ids is empty array', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: [],
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('target_profile_ids');
  });

  it('returns 400 if target_profile_ids is not an array', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: 'not-an-array',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('target_profile_ids');
  });

  it('triggers broadcast task with correct payload', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockTrigger.mockResolvedValue({ id: 'run-123' });

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: ['profile-1', 'profile-2'],
      stagger_days: 3,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockTrigger).toHaveBeenCalledWith('broadcast-post-variations', {
      sourcePostId: 'post-1',
      targetProfileIds: ['profile-1', 'profile-2'],
      userId: 'user-1',
      staggerDays: 3,
    });
  });

  it('returns success with run_id', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockTrigger.mockResolvedValue({ id: 'run-abc-456' });

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: ['profile-1'],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.run_id).toBe('run-abc-456');
    expect(data.message).toContain('1 team member');
  });

  it('defaults stagger_days to 2 when not provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockTrigger.mockResolvedValue({ id: 'run-123' });

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: ['profile-1'],
    });
    await POST(request);

    expect(mockTrigger).toHaveBeenCalledWith(
      'broadcast-post-variations',
      expect.objectContaining({ staggerDays: 2 })
    );
  });

  it('clamps stagger_days to valid range (1-5)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockTrigger.mockResolvedValue({ id: 'run-123' });

    // Test above max
    const request1 = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: ['profile-1'],
      stagger_days: 10,
    });
    await POST(request1);
    expect(mockTrigger).toHaveBeenCalledWith(
      'broadcast-post-variations',
      expect.objectContaining({ staggerDays: 5 })
    );

    mockTrigger.mockClear();

    // Test below min
    const request2 = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: ['profile-1'],
      stagger_days: 0,
    });
    await POST(request2);
    expect(mockTrigger).toHaveBeenCalledWith(
      'broadcast-post-variations',
      expect.objectContaining({ staggerDays: 1 })
    );
  });

  it('returns 500 when task trigger fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockTrigger.mockRejectedValue(new Error('Trigger.dev connection failed'));

    const request = createBroadcastRequest({
      source_post_id: 'post-1',
      target_profile_ids: ['profile-1'],
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
