// API Route: Webhook Configurations
// GET, POST /api/webhooks

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { webhookConfigFromRow, type WebhookConfigRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET - List all webhooks for current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logApiError('webhooks/list', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch webhooks');
    }

    const webhooks = (data as WebhookConfigRow[]).map(webhookConfigFromRow);

    return NextResponse.json({ webhooks });
  } catch (error) {
    logApiError('webhooks/list', error);
    return ApiErrors.internalError('Failed to fetch webhooks');
  }
}

// POST - Create a new webhook
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { name, url } = body;

    if (!name || !url) {
      return ApiErrors.validationError('name and url are required');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return ApiErrors.validationError('Invalid URL format');
    }

    // Only allow HTTPS URLs
    if (!url.startsWith('https://')) {
      return ApiErrors.validationError('Webhook URL must use HTTPS');
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('webhook_configs')
      .insert({
        user_id: session.user.id,
        name,
        url,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logApiError('webhooks/create', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create webhook');
    }

    return NextResponse.json(
      { webhook: webhookConfigFromRow(data as WebhookConfigRow) },
      { status: 201 }
    );
  } catch (error) {
    logApiError('webhooks/create', error);
    return ApiErrors.internalError('Failed to create webhook');
  }
}
