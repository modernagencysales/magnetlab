// API Route: Webhook Configurations
// GET, POST /api/webhooks

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { webhookConfigFromRow, type WebhookConfigRow } from '@/lib/types/funnel';

// GET - List all webhooks for current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('List webhooks error:', error);
      return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
    }

    const webhooks = (data as WebhookConfigRow[]).map(webhookConfigFromRow);

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error('List webhooks error:', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

// POST - Create a new webhook
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'name and url are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow HTTPS URLs
    if (!url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Webhook URL must use HTTPS' },
        { status: 400 }
      );
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
      console.error('Create webhook error:', error);
      return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
    }

    return NextResponse.json(
      { webhook: webhookConfigFromRow(data as WebhookConfigRow) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create webhook error:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}
