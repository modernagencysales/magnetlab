// API Route: Individual LinkedIn Automation
// GET /api/linkedin/automations/[id] — Get automation with recent events
// PATCH /api/linkedin/automations/[id] — Update automation fields
// DELETE /api/linkedin/automations/[id] — Delete automation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as linkedinService from '@/server/services/linkedin.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const result = await linkedinService.getAutomation(session.user.id, id);
    if (!result.success) {
      return ApiErrors.notFound('Automation');
    }

    return NextResponse.json({ automation: result.automation, events: result.events });
  } catch (error) {
    logApiError('linkedin/automations/get', error);
    return ApiErrors.internalError('Failed to fetch automation');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const body = await request.json();
<<<<<<< HEAD
    const result = await linkedinService.updateAutomation(session.user.id, id, body);
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
=======
    const supabase = createSupabaseAdminClient();

    // Build update object from allowed fields
    const allowedFields = [
      'name', 'post_social_id', 'keywords', 'dm_template',
      'auto_connect', 'auto_like', 'comment_reply_template',
      'enable_follow_up', 'follow_up_template', 'follow_up_delay_minutes',
      'status', 'unipile_account_id', 'heyreach_campaign_id', 'resource_url',
      'plusvibe_campaign_id', 'opt_in_url',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      // Convert camelCase input to snake_case field names
      const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (camelField in body) {
        updates[field] = body[camelField];
      } else if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError('No valid fields to update');
    }

    // Validate status transitions
    if (updates.status) {
      const validStatuses = ['draft', 'running', 'paused'];
      if (!validStatuses.includes(updates.status as string)) {
        return ApiErrors.validationError(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('linkedin_automations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error || !data) {
      logApiError('linkedin/automations/update', error);
>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47
      return ApiErrors.notFound('Automation');
    }

    return NextResponse.json({ automation: result.automation });
  } catch (error) {
    logApiError('linkedin/automations/update', error);
    return ApiErrors.internalError('Failed to update automation');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const result = await linkedinService.deleteAutomation(session.user.id, id);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to delete automation');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('linkedin/automations/delete', error);
    return ApiErrors.internalError('Failed to delete automation');
  }
}
