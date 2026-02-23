// API Route: Subscriber Sync Webhook
// POST /api/webhooks/subscriber-sync
//
// Called by gtm-system when warm leads come in (positive replies, meetings booked,
// purchases). Upserts into email_subscribers with "keep richest record" merge logic.
//
// Auth: x-webhook-secret header must match SUBSCRIBER_SYNC_WEBHOOK_SECRET env var.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  team_id: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_SOURCES = [
  'lead_magnet',
  'manual',
  'import',
  'csv_import',
  'resend_import',
  'positive_reply',
  'purchaser',
  'meeting',
  'heyreach',
  'plusvibe',
  'gtm_sync',
];

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth: verify webhook secret
    const secret = request.headers.get('x-webhook-secret');
    if (!secret || secret !== process.env.SUBSCRIBER_SYNC_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    let payload: SyncPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 3. Validate required fields
    if (!payload.email || typeof payload.email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    if (!payload.team_id || typeof payload.team_id !== 'string') {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
    }

    const email = payload.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (!UUID_RE.test(payload.team_id)) {
      return NextResponse.json({ error: 'Invalid team_id format' }, { status: 400 });
    }

    // 4. Validate source if provided
    const source = payload.source || 'gtm_sync';
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 },
      );
    }

    // 5. Fetch existing subscriber to merge (keep richest record)
    const supabase = createSupabaseAdminClient();

    const { data: existing } = await supabase
      .from('email_subscribers')
      .select('id, first_name, last_name, company, metadata')
      .eq('team_id', payload.team_id)
      .eq('email', email)
      .maybeSingle();

    // Build upsert data — keep richest record
    const upsertData: Record<string, unknown> = {
      team_id: payload.team_id,
      email,
      source,
      status: 'active',
    };

    // Merge name/company: prefer new value if provided, else keep existing
    upsertData.first_name = payload.first_name?.trim() || existing?.first_name || null;
    upsertData.last_name = payload.last_name?.trim() || existing?.last_name || null;
    upsertData.company = payload.company?.trim() || existing?.company || null;

    // Merge metadata: shallow-merge incoming into existing
    const existingMetadata = (existing?.metadata as Record<string, unknown>) || {};
    const incomingMetadata = payload.metadata || {};
    upsertData.metadata = { ...existingMetadata, ...incomingMetadata };

    // 6. Upsert
    const { data: subscriber, error: upsertError } = await supabase
      .from('email_subscribers')
      .upsert(upsertData, { onConflict: 'team_id,email' })
      .select('id, email, first_name, last_name, company, source, status')
      .single();

    if (upsertError) {
      logError('webhooks/subscriber-sync', new Error(upsertError.message), {
        email,
        team_id: payload.team_id,
      });
      return NextResponse.json(
        { error: 'Failed to sync subscriber' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      subscriber,
      merged: !!existing,
    });
  } catch (error) {
    logError('webhooks/subscriber-sync', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
