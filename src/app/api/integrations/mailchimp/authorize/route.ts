// Mailchimp OAuth Authorize
// GET /api/integrations/mailchimp/authorize
// Initiates Mailchimp OAuth flow with CSRF state cookie

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { ApiErrors } from '@/lib/api/errors';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return ApiErrors.unauthorized();
  }

  const clientId = process.env.MAILCHIMP_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !appUrl) {
    return ApiErrors.internalError('Mailchimp OAuth is not configured');
  }

  // Generate CSRF state token
  const state = crypto.randomUUID();

  // Store state in httpOnly cookie for validation in callback
  const cookieStore = await cookies();
  cookieStore.set('mailchimp_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const redirectUri = `${appUrl}/api/integrations/mailchimp/callback`;
  const authUrl = new URL('https://login.mailchimp.com/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
