import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { importProspects } from '@/server/services/signals.service';

const SERVICE_KEY = process.env.PROSPECT_SYNC_SECRET;

export async function POST(req: NextRequest) {
  // Dual auth: service key header OR session auth
  const serviceKey = req.headers.get('x-service-key');
  let userId: string | null = null;

  if (serviceKey && SERVICE_KEY && serviceKey === SERVICE_KEY) {
    // Cross-repo call — use the configured sync user
    userId = process.env.SIGNAL_SYNC_USER_ID || null;
  } else {
    // Session auth (MCP or direct API)
    const session = await auth();
    userId = session?.user?.id || null;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const prospects = body.prospects;

  if (!Array.isArray(prospects) || prospects.length === 0) {
    return NextResponse.json(
      { error: 'prospects array is required and must not be empty' },
      { status: 400 }
    );
  }

  if (prospects.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 prospects per request' }, { status: 400 });
  }

  const result = await importProspects(userId, prospects);
  return NextResponse.json(result);
}
