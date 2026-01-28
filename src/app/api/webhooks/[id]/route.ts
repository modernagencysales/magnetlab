// API Route: Single Webhook Configuration
// PUT, DELETE /api/webhooks/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { webhookConfigFromRow, type WebhookConfigRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Update a webhook
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.url !== undefined) {
      // Validate URL format
      try {
        new URL(body.url);
      } catch {
        return ApiErrors.validationError('Invalid URL format');
      }

      if (!body.url.startsWith('https://')) {
        return ApiErrors.validationError('Webhook URL must use HTTPS');
      }

      updateData.url = body.url;
    }

    if (body.isActive !== undefined) {
      updateData.is_active = body.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return ApiErrors.validationError('No valid fields to update');
    }

    const { data, error } = await supabase
      .from('webhook_configs')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      logApiError('webhooks/update', error, { webhookId: id });
      return ApiErrors.databaseError('Failed to update webhook');
    }

    if (!data) {
      return ApiErrors.notFound('Webhook');
    }

    return NextResponse.json({ webhook: webhookConfigFromRow(data as WebhookConfigRow) });
  } catch (error) {
    logApiError('webhooks/update', error);
    return ApiErrors.internalError('Failed to update webhook');
  }
}

// DELETE - Delete a webhook
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('webhook_configs')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      logApiError('webhooks/delete', error, { webhookId: id });
      return ApiErrors.databaseError('Failed to delete webhook');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('webhooks/delete', error);
    return ApiErrors.internalError('Failed to delete webhook');
  }
}

// POST - Test webhook
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Get webhook
    const { data: webhook, error } = await supabase
      .from('webhook_configs')
      .select('url, name')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !webhook) {
      return ApiErrors.notFound('Webhook');
    }

    // Send test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from MagnetLab',
        webhookName: webhook.name,
      },
    };

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'test',
          'X-Webhook-Id': id,
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          status: response.status,
          message: `Webhook returned status ${response.status}`,
        });
      }

      return NextResponse.json({
        success: true,
        status: response.status,
        message: 'Test webhook delivered successfully',
      });
    } catch (fetchError) {
      return NextResponse.json({
        success: false,
        message: fetchError instanceof Error ? fetchError.message : 'Request failed',
      });
    }
  } catch (error) {
    logApiError('webhooks/test', error);
    return ApiErrors.internalError('Failed to test webhook');
  }
}
