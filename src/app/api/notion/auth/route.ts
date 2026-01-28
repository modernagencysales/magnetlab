// API Route: Notion OAuth
// GET /api/notion/auth - Start OAuth flow
// GET /api/notion/auth?code=xxx - OAuth callback
//
// Note: Access tokens are encrypted at rest using Supabase Vault.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNotionOAuthUrl, exchangeNotionCode } from '@/lib/integrations/notion';
import { upsertNotionConnection } from '@/lib/utils/encrypted-storage';
import { logApiError } from '@/lib/api/errors';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth callback
    if (code) {
      // Verify state matches session user
      if (state !== session.user.id) {
        return NextResponse.redirect(
          new URL('/settings?error=invalid_state', request.url)
        );
      }

      try {
        // Exchange code for tokens
        const tokens = await exchangeNotionCode(code);

        // Save to database with encrypted access token
        await upsertNotionConnection({
          userId: session.user.id,
          accessToken: tokens.access_token,
          workspaceId: tokens.workspace_id,
          workspaceName: tokens.workspace_name,
          workspaceIcon: tokens.workspace_icon,
          botId: tokens.bot_id,
        });

        return NextResponse.redirect(
          new URL('/settings?notion=connected', request.url)
        );
      } catch (err) {
        logApiError('notion/auth/callback', err);
        return NextResponse.redirect(
          new URL('/settings?error=notion_auth_failed', request.url)
        );
      }
    }

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?error=${error}`, request.url)
      );
    }

    // Start OAuth flow - redirect to Notion
    const authUrl = getNotionOAuthUrl(session.user.id);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logApiError('notion/auth', error);
    return NextResponse.redirect(
      new URL('/settings?error=auth_error', request.url)
    );
  }
}
