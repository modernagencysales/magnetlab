import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { exchangeFathomCode } from '@/lib/integrations/fathom';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { cookies } from 'next/headers';

import { logError } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/settings?fathom=error&reason=unauthorized', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?fathom=error&reason=missing_params', request.url));
  }

  // Validate state against cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('fathom_oauth_state')?.value;
  cookieStore.delete('fathom_oauth_state');

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL('/settings?fathom=error&reason=invalid_state', request.url));
  }

  try {
    const tokens = await exchangeFathomCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await upsertUserIntegration({
      userId: session.user.id,
      service: 'fathom',
      apiKey: tokens.access_token,
      isActive: true,
      metadata: {
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        last_synced_at: null,
      },
    });

    return NextResponse.redirect(new URL('/settings?fathom=connected', request.url));
  } catch (error) {
    logError('api/integrations/fathom', error, { step: 'fathom_oauth_callback_error' });
    return NextResponse.redirect(new URL('/settings?fathom=error&reason=token_exchange_failed', request.url));
  }
}
