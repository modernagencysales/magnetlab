// Fathom API client + OAuth helpers
// API docs: https://developers.fathom.ai/

import { BaseApiClient } from './base-client';
import {
  getUserIntegration,
  upsertUserIntegration,
} from '@/lib/utils/encrypted-storage';

// =============================================================================
// TYPES
// =============================================================================

interface FathomMeeting {
  id: string;
  title: string;
  created_at: string;
  duration_seconds: number;
  attendees: string[];
}

interface FathomMeetingsResponse {
  meetings: FathomMeeting[];
  has_more: boolean;
  next_cursor: string | null;
}

interface FathomTranscriptResponse {
  transcript: string;
}

interface FathomTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// =============================================================================
// OAUTH HELPERS (static, not on BaseApiClient)
// =============================================================================

const FATHOM_AUTH_URL = 'https://fathom.video/oauth/authorize';
const FATHOM_TOKEN_URL = 'https://fathom.video/oauth/token';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getFathomAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('FATHOM_CLIENT_ID'),
    redirect_uri: requireEnv('FATHOM_REDIRECT_URI'),
    response_type: 'code',
    scope: 'public_api',
    state,
  });
  return `${FATHOM_AUTH_URL}?${params.toString()}`;
}

export async function exchangeFathomCode(code: string): Promise<FathomTokenResponse> {
  const response = await fetch(FATHOM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: requireEnv('FATHOM_CLIENT_ID'),
      client_secret: requireEnv('FATHOM_CLIENT_SECRET'),
      redirect_uri: requireEnv('FATHOM_REDIRECT_URI'),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fathom token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function refreshFathomToken(refreshToken: string): Promise<FathomTokenResponse> {
  const response = await fetch(FATHOM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: requireEnv('FATHOM_CLIENT_ID'),
      client_secret: requireEnv('FATHOM_CLIENT_SECRET'),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fathom token refresh failed: ${response.status} ${text}`);
  }

  return response.json();
}

// =============================================================================
// API CLIENT
// =============================================================================

export class FathomClient extends BaseApiClient {
  constructor(accessToken: string) {
    super({
      baseUrl: 'https://api.fathom.video/external/v1',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async listMeetings(params?: { created_after?: string; cursor?: string }) {
    const query = new URLSearchParams();
    if (params?.created_after) query.set('created_after', params.created_after);
    if (params?.cursor) query.set('cursor', params.cursor);
    const qs = query.toString();
    return this.get<FathomMeetingsResponse>(`/meetings${qs ? `?${qs}` : ''}`);
  }

  async getTranscript(recordingId: string) {
    return this.get<FathomTranscriptResponse>(`/meetings/${recordingId}/transcript`);
  }

  async verifyConnection() {
    // Simple test call — list 1 meeting to verify the token works
    return this.get<FathomMeetingsResponse>('/meetings?limit=1');
  }
}

// =============================================================================
// FACTORY: get authenticated client for a user
// =============================================================================

export async function getUserFathomClient(userId: string): Promise<FathomClient | null> {
  const integration = await getUserIntegration(userId, 'fathom');
  if (!integration || !integration.is_active || !integration.api_key) {
    return null;
  }

  const metadata = integration.metadata as {
    refresh_token?: string;
    token_expires_at?: string;
    last_synced_at?: string;
  };

  // Check if token is expired (with 5-minute buffer)
  const expiresAt = metadata.token_expires_at ? new Date(metadata.token_expires_at) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() + 5 * 60 * 1000 : false;

  if (isExpired && metadata.refresh_token) {
    try {
      const tokens = await refreshFathomToken(metadata.refresh_token);
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await upsertUserIntegration({
        userId,
        service: 'fathom',
        apiKey: tokens.access_token,
        isActive: true,
        metadata: {
          ...metadata,
          refresh_token: tokens.refresh_token,
          token_expires_at: newExpiresAt,
        },
      });

      return new FathomClient(tokens.access_token);
    } catch (error) {
      console.error(`Fathom token refresh failed for user ${userId}:`, error);
      // Mark integration as inactive — user needs to re-authorize
      await upsertUserIntegration({
        userId,
        service: 'fathom',
        apiKey: integration.api_key,
        isActive: false,
        metadata: { ...metadata, error: 'Token refresh failed — please reconnect' },
      });
      return null;
    }
  }

  return new FathomClient(integration.api_key);
}
