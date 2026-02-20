// Mailchimp OAuth Callback
// GET /api/integrations/mailchimp/callback
// Exchanges authorization code for access token, fetches server prefix, saves integration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { cookies } from 'next/headers';
import { logError } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL('/settings?mailchimp=error&reason=unauthorized', request.url)
    );
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings?mailchimp=error&reason=missing_params', request.url)
    );
  }

  // Validate CSRF state against cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('mailchimp_oauth_state')?.value;
  cookieStore.delete('mailchimp_oauth_state');

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL('/settings?mailchimp=error&reason=invalid_state', request.url)
    );
  }

  const clientId = process.env.MAILCHIMP_CLIENT_ID;
  const clientSecret = process.env.MAILCHIMP_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return NextResponse.redirect(
      new URL('/settings?mailchimp=error&reason=not_configured', request.url)
    );
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://login.mailchimp.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/integrations/mailchimp/callback`,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logError('api/integrations/mailchimp', new Error(errorText), {
        step: 'token_exchange',
      });
      return NextResponse.redirect(
        new URL('/settings?mailchimp=error&reason=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken: string = tokenData.access_token;

    // Get server prefix (data center) from metadata endpoint
    const metadataResponse = await fetch('https://login.mailchimp.com/oauth2/metadata', {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      logError('api/integrations/mailchimp', new Error(errorText), {
        step: 'metadata_fetch',
      });
      return NextResponse.redirect(
        new URL('/settings?mailchimp=error&reason=metadata_failed', request.url)
      );
    }

    const metadata = await metadataResponse.json();
    const dc: string = metadata.dc; // e.g. "us21"
    const accountName: string = metadata.accountname || metadata.account_name || '';

    // Save the integration
    await upsertUserIntegration({
      userId: session.user.id,
      service: 'mailchimp',
      apiKey: accessToken,
      isActive: true,
      metadata: {
        server_prefix: dc,
        account_name: accountName,
      },
    });

    return NextResponse.redirect(
      new URL('/settings?mailchimp=connected', request.url)
    );
  } catch (error) {
    logError('api/integrations/mailchimp', error, {
      step: 'oauth_callback_error',
    });
    return NextResponse.redirect(
      new URL('/settings?mailchimp=error&reason=unexpected_error', request.url)
    );
  }
}
