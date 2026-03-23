/**
 * @jest-environment node
 */

import { GET } from '@/app/api/content-pipeline/linkedin/accounts/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock the service
jest.mock('@/server/services/linkedin-accounts.service', () => ({
  listLinkedInAccounts: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { listLinkedInAccounts } from '@/server/services/linkedin-accounts.service';

describe('GET /api/content-pipeline/linkedin/accounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/content-pipeline/linkedin/accounts');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns accounts for the authenticated user', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const mockAccounts = [
      { unipile_account_id: 'acc-1', name: 'Alice', status: 'ok', source: 'user' },
    ];
    (listLinkedInAccounts as jest.Mock).mockResolvedValue(mockAccounts);

    const request = new Request('http://localhost:3000/api/content-pipeline/linkedin/accounts');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.accounts).toEqual(mockAccounts);
    expect(listLinkedInAccounts).toHaveBeenCalledWith('user-1', undefined, false);
  });

  it('passes team_id and refresh=true to the service', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (listLinkedInAccounts as jest.Mock).mockResolvedValue([]);

    const request = new Request(
      'http://localhost:3000/api/content-pipeline/linkedin/accounts?team_id=team-42&refresh=true'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(listLinkedInAccounts).toHaveBeenCalledWith('user-1', 'team-42', true);
  });

  it('returns empty accounts array when no accounts found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-2' } });
    (listLinkedInAccounts as jest.Mock).mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/content-pipeline/linkedin/accounts');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.accounts).toEqual([]);
  });
});
