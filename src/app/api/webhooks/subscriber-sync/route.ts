// POST /api/webhooks/subscriber-sync - Upserts email_subscribers from GTM warm leads.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logError } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_SOURCES = [
  'lead_magnet', 'manual', 'import', 'csv_import', 'resend_import',
  'positive_reply', 'purchaser', 'meeting', 'heyreach', 'plusvibe', 'gtm_sync',
];

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-webhook-secret');
    const expected = process.env.SUBSCRIBER_SYNC_WEBHOOK_SECRET || '';
    const isValid =
      secret &&
      expected &&
      secret.length === expected.length &&
      timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const p = payload as Record<string, unknown>;
    if (!p.email || typeof p.email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }
    if (!p.team_id || typeof p.team_id !== 'string') {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
    }

    const email = (p.email as string).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    if (!UUID_RE.test(p.team_id as string)) {
      return NextResponse.json({ error: 'Invalid team_id format' }, { status: 400 });
    }

    const source = (p.source as string) || 'gtm_sync';
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await webhooksIncomingService.handleSubscriberSync({
      email: p.email as string,
      team_id: p.team_id as string,
      first_name: p.first_name as string | undefined,
      last_name: p.last_name as string | undefined,
      company: p.company as string | undefined,
      source,
      metadata: p.metadata as Record<string, unknown> | undefined,
    });

    if (!result.success) {
      logError('webhooks/subscriber-sync', new Error(result.error), {
        email,
        team_id: p.team_id,
      });
      return NextResponse.json({ error: 'Failed to sync subscriber' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscriber: result.subscriber,
      merged: result.merged,
    });
  } catch (error) {
    logError('webhooks/subscriber-sync', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
