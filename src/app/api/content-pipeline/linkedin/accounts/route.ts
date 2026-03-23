/** List LinkedIn Accounts. Returns connected Unipile accounts for the authenticated user. */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listLinkedInAccounts } from '@/server/services/linkedin-accounts.service';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const teamId = url.searchParams.get('team_id') ?? undefined;
  const refresh = url.searchParams.get('refresh') === 'true';

  const accounts = await listLinkedInAccounts(session.user.id, teamId, refresh);
  return NextResponse.json({ accounts });
}
