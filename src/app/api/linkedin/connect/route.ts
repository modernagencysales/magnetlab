import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUnipileClient, isUnipileConfigured } from '@/lib/integrations/unipile';

import { logError } from '@/lib/utils/logger';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isUnipileConfigured()) {
    const errorUrl = new URL('/settings', process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    errorUrl.searchParams.set('linkedin', 'error');
    errorUrl.searchParams.set('reason', 'not_configured');
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    const client = getUnipileClient();
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const result = await client.requestHostedAuthLink({
      userId: session.user.id,
      successRedirectUrl: `${appUrl}/settings?linkedin=connected`,
      failureRedirectUrl: `${appUrl}/settings?linkedin=error&reason=auth_failed`,
      notifyUrl: `${appUrl}/api/webhooks/unipile`,
    });

    if (result.error || !result.data?.url) {
      logError('api/linkedin', new Error(String(result.error)), { step: 'unipile_hosted_auth_link_error' });
      const errorUrl = new URL('/settings', appUrl);
      errorUrl.searchParams.set('linkedin', 'error');
      errorUrl.searchParams.set('reason', 'link_failed');
      return NextResponse.redirect(errorUrl.toString());
    }

    return NextResponse.redirect(result.data.url);
  } catch (error) {
    logError('api/linkedin', error, { step: 'linkedin_connect_error' });
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorUrl = new URL('/settings', appUrl);
    errorUrl.searchParams.set('linkedin', 'error');
    errorUrl.searchParams.set('reason', 'link_failed');
    return NextResponse.redirect(errorUrl.toString());
  }
}
