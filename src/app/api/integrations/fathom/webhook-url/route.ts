import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getUserIntegration,
  upsertUserIntegration,
  deleteUserIntegration,
} from '@/lib/utils/encrypted-storage';
import { logError } from '@/lib/utils/logger';

/**
 * GET — Return existing webhook URL if configured
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await getUserIntegration(session.user.id, 'fathom');
    if (!integration || !integration.webhook_secret || !integration.is_active) {
      return NextResponse.json({ configured: false });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.magnetlab.app';
    const webhookUrl = `${baseUrl}/api/webhooks/fathom/${session.user.id}?secret=${integration.webhook_secret}`;
    return NextResponse.json({ configured: true, webhook_url: webhookUrl });
  } catch (error) {
    logError('api/integrations/fathom/webhook-url', error, { method: 'GET' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — Generate (or regenerate) webhook URL
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = crypto.randomUUID();

    await upsertUserIntegration({
      userId: session.user.id,
      service: 'fathom',
      webhookSecret: secret,
      isActive: true,
      metadata: { created_via: 'webhook_setup' },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.magnetlab.app';
    const webhookUrl = `${baseUrl}/api/webhooks/fathom/${session.user.id}?secret=${secret}`;

    return NextResponse.json({ configured: true, webhook_url: webhookUrl });
  } catch (error) {
    logError('api/integrations/fathom/webhook-url', error, { method: 'POST' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE — Disconnect Fathom integration
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteUserIntegration(session.user.id, 'fathom');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/integrations/fathom/webhook-url', error, { method: 'DELETE' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
