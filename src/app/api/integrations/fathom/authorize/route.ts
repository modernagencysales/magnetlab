import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFathomAuthorizationUrl } from '@/lib/integrations/fathom';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set('fathom_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const authUrl = getFathomAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
