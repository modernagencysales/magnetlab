// API Route: Email Broadcast by ID
// GET — Get a single broadcast
// PUT — Update a draft broadcast
// DELETE — Delete a draft broadcast

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { updateBroadcastSchema } from '@/lib/types/email-system';

const BROADCAST_COLUMNS =
  'id, team_id, user_id, subject, body, status, audience_filter, recipient_count, sent_at, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET — Get a single broadcast with team ownership check
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid broadcast ID format');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    const { data: broadcast, error } = await supabase
      .from('email_broadcasts')
      .select(BROADCAST_COLUMNS)
      .eq('id', id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (error) {
      logApiError('email/broadcasts/get', error, { id, teamId });
      return ApiErrors.databaseError('Failed to get broadcast');
    }

    if (!broadcast) {
      return ApiErrors.notFound('Broadcast');
    }

    return NextResponse.json({ broadcast });
  } catch (error) {
    logApiError('email/broadcasts/get', error);
    return ApiErrors.internalError('Failed to get broadcast');
  }
}

// PUT — Update a draft broadcast (subject, body, audience_filter)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid broadcast ID format');
    }

    const body = await request.json();
    const parsed = updateBroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid broadcast data',
        parsed.error.issues
      );
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Verify broadcast exists, belongs to team, and is a draft
    const { data: existing, error: findError } = await supabase
      .from('email_broadcasts')
      .select('id, status')
      .eq('id', id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (findError) {
      logApiError('email/broadcasts/update/find', findError, { id, teamId });
      return ApiErrors.databaseError('Failed to look up broadcast');
    }

    if (!existing) {
      return ApiErrors.notFound('Broadcast');
    }

    if (existing.status !== 'draft') {
      return ApiErrors.validationError('Only draft broadcasts can be updated');
    }

    // Build update data from validated fields
    const updateData: Record<string, unknown> = {};
    if (parsed.data.subject !== undefined) updateData.subject = parsed.data.subject;
    if (parsed.data.body !== undefined) updateData.body = parsed.data.body;
    if (parsed.data.audience_filter !== undefined) updateData.audience_filter = parsed.data.audience_filter;

    const { data: broadcast, error } = await supabase
      .from('email_broadcasts')
      .update(updateData)
      .eq('id', id)
      .eq('team_id', teamId)
      .select(BROADCAST_COLUMNS)
      .single();

    if (error) {
      logApiError('email/broadcasts/update', error, { id, teamId });
      return ApiErrors.databaseError('Failed to update broadcast');
    }

    return NextResponse.json({ broadcast });
  } catch (error) {
    logApiError('email/broadcasts/update', error);
    return ApiErrors.internalError('Failed to update broadcast');
  }
}

// DELETE — Delete a draft broadcast
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid broadcast ID format');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Verify broadcast exists, belongs to team, and is a draft
    const { data: existing, error: findError } = await supabase
      .from('email_broadcasts')
      .select('id, status')
      .eq('id', id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (findError) {
      logApiError('email/broadcasts/delete/find', findError, { id, teamId });
      return ApiErrors.databaseError('Failed to look up broadcast');
    }

    if (!existing) {
      return ApiErrors.notFound('Broadcast');
    }

    if (existing.status !== 'draft') {
      return ApiErrors.validationError('Only draft broadcasts can be deleted');
    }

    const { error } = await supabase
      .from('email_broadcasts')
      .delete()
      .eq('id', id)
      .eq('team_id', teamId);

    if (error) {
      logApiError('email/broadcasts/delete', error, { id, teamId });
      return ApiErrors.databaseError('Failed to delete broadcast');
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError('email/broadcasts/delete', error);
    return ApiErrors.internalError('Failed to delete broadcast');
  }
}
