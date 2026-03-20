/**
 * GET /api/copilot/homepage-data.
 * Purpose: Combined homepage data (suggestions + stats + conversations).
 * Constraint: Auth required. Delegates to homepage-data service.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { getHomepageData, getStatusCode } from '@/server/services/homepage-data.service';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getHomepageData(session.user.id, session.user.name ?? undefined);
    return NextResponse.json(data);
  } catch (err) {
    logError('GET /api/copilot/homepage-data', err, { userId: session.user.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(err) });
  }
}
