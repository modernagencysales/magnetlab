/**
 * @jest-environment node
 *
 * API route tests for POST /api/lead-magnet-post/launch.
 * Tests auth, team scope validation, input validation, publish_only mode, and full launch delegation.
 */

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockGetDataScope = jest.fn();
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: (...args: unknown[]) => mockGetDataScope(...args),
}));

const mockLaunch = jest.fn();
const mockPublish = jest.fn();
jest.mock('@/server/services/lead-magnet-post-launcher.service', () => ({
  launchLeadMagnetPost: (...args: unknown[]) => mockLaunch(...args),
  publishLinkedInPost: (...args: unknown[]) => mockPublish(...args),
  getStatusCode: (err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      return (err as { statusCode: number }).statusCode;
    }
    return 500;
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/lead-magnet-post/launch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/lead-magnet-post/launch', () => {
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/lead-magnet-post/launch/route');
    POST = mod.POST;
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ team_profile_id: 'p1', post_text: 'hi' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when team_profile_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    const res = await POST(makeRequest({ post_text: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when post_text is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    const res = await POST(makeRequest({ team_profile_id: 'p1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when not in team scope', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'user', userId: 'u1' });
    const res = await POST(makeRequest({ team_profile_id: 'p1', post_text: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('handles publish_only mode', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockPublish.mockResolvedValue({
      linkedinPostUrl: 'https://linkedin.com/feed/update/urn:li:activity:123',
      linkedinPostId: 'urn:li:activity:123',
    });

    const res = await POST(
      makeRequest({
        team_profile_id: 'p1',
        post_text: 'Hello',
        publish_only: true,
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.linkedinPostUrl).toBeDefined();
    expect(mockPublish).toHaveBeenCalledWith('p1', 'Hello');
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('returns 200 with launch result on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockLaunch.mockResolvedValue({
      linkedinPostUrl: 'https://linkedin.com/feed/update/urn:li:activity:123',
      linkedinPostId: 'urn:li:activity:123',
      campaignId: 'camp1',
      campaignName: 'Test Campaign',
      status: 'active',
      keywords: ['guide'],
      funnelPageId: 'f1',
    });

    const res = await POST(
      makeRequest({
        team_profile_id: 'p1',
        post_text: 'Check out my guide',
        funnel_page_id: 'f1',
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.linkedinPostUrl).toBeDefined();
    expect(body.campaignId).toBe('camp1');
    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        teamId: 't1',
        teamProfileId: 'p1',
        postText: 'Check out my guide',
        funnelPageId: 'f1',
      })
    );
  });

  it('forwards optional parameters to the launcher', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockLaunch.mockResolvedValue({
      linkedinPostUrl: 'https://linkedin.com/feed/update/urn:li:activity:456',
      linkedinPostId: 'urn:li:activity:456',
      campaignId: 'camp2',
      campaignName: 'Custom Name',
      status: 'active',
      keywords: ['ebook'],
      funnelPageId: null,
    });

    await POST(
      makeRequest({
        team_profile_id: 'p1',
        post_text: 'Get my ebook',
        keywords: ['ebook'],
        dm_template: 'Hey {{name}}!',
        campaign_name: 'Custom Name',
      })
    );
    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ['ebook'],
        dmTemplate: 'Hey {{name}}!',
        campaignName: 'Custom Name',
      })
    );
  });

  it('returns service error status codes', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockLaunch.mockRejectedValue(
      Object.assign(new Error('LinkedIn not connected'), { statusCode: 400 })
    );

    const res = await POST(makeRequest({ team_profile_id: 'p1', post_text: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 for unexpected errors', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockLaunch.mockRejectedValue(new Error('Unexpected failure'));

    const res = await POST(makeRequest({ team_profile_id: 'p1', post_text: 'hi' }));
    expect(res.status).toBe(500);
  });
});
