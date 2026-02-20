// API Route: Send a Broadcast
// POST — Queue a draft broadcast for sending via Trigger.dev

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { tasks } from '@trigger.dev/sdk/v3';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST — Send a broadcast (validates, counts recipients, triggers background task)
export async function POST(request: Request, { params }: RouteParams) {
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
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Fetch the broadcast and verify ownership
    const { data: broadcast, error: findError } = await supabase
      .from('email_broadcasts')
      .select('id, team_id, subject, body, status, audience_filter')
      .eq('id', id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (findError) {
      logApiError('email/broadcasts/send/find', findError, { id, teamId });
      return ApiErrors.databaseError('Failed to look up broadcast');
    }

    if (!broadcast) {
      return ApiErrors.notFound('Broadcast');
    }

    // Validate broadcast is ready to send
    if (broadcast.status !== 'draft') {
      return ApiErrors.validationError('Only draft broadcasts can be sent');
    }

    if (!broadcast.subject || broadcast.subject.trim() === '') {
      return ApiErrors.validationError('Broadcast must have a subject before sending');
    }

    if (!broadcast.body || broadcast.body.trim() === '') {
      return ApiErrors.validationError('Broadcast must have a body before sending');
    }

    // Get recipient count via RPC
    const { data: countData, error: countError } = await supabase
      .rpc('get_filtered_subscriber_count', {
        p_team_id: teamId,
        p_filter: broadcast.audience_filter || {},
      });

    if (countError) {
      logApiError('email/broadcasts/send/count', countError, { id, teamId });
      return ApiErrors.databaseError('Failed to count recipients');
    }

    const recipientCount = countData ?? 0;

    if (recipientCount === 0) {
      return ApiErrors.validationError('No subscribers match the audience filter');
    }

    // Update status to 'sending' and record recipient count
    const { error: updateError } = await supabase
      .from('email_broadcasts')
      .update({
        status: 'sending',
        recipient_count: recipientCount,
      })
      .eq('id', id)
      .eq('team_id', teamId);

    if (updateError) {
      logApiError('email/broadcasts/send/update', updateError, { id, teamId });
      return ApiErrors.databaseError('Failed to update broadcast status');
    }

    // Trigger the send-broadcast background task
    await tasks.trigger('send-broadcast', {
      broadcast_id: id,
      team_id: teamId,
      user_id: session.user.id,
    });

    return NextResponse.json({
      message: 'Broadcast queued for sending',
      recipient_count: recipientCount,
    });
  } catch (error) {
    logApiError('email/broadcasts/send', error);
    return ApiErrors.internalError('Failed to send broadcast');
  }
}
