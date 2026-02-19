// API Route: Email Subscriber by ID
// DELETE — Unsubscribe a subscriber (soft delete: sets status + unsubscribed_at)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE — Unsubscribe a subscriber and deactivate their flow contacts
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid subscriber ID format');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Verify the subscriber belongs to this team
    const { data: subscriber, error: findError } = await supabase
      .from('email_subscribers')
      .select('id, team_id, status')
      .eq('id', id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (findError) {
      logApiError('email/subscribers/delete/find', findError, { id, teamId });
      return ApiErrors.databaseError('Failed to look up subscriber');
    }

    if (!subscriber) {
      return ApiErrors.notFound('Subscriber');
    }

    if (subscriber.status === 'unsubscribed') {
      return NextResponse.json({ message: 'Subscriber already unsubscribed' });
    }

    const now = new Date().toISOString();

    // Unsubscribe the subscriber and deactivate their flow contacts in parallel
    const [updateResult, flowResult] = await Promise.all([
      supabase
        .from('email_subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: now })
        .eq('id', id)
        .eq('team_id', teamId),
      supabase
        .from('email_flow_contacts')
        .update({ status: 'unsubscribed' })
        .eq('subscriber_id', id)
        .eq('team_id', teamId)
        .eq('status', 'active'),
    ]);

    if (updateResult.error) {
      logApiError('email/subscribers/delete/update', updateResult.error, { id, teamId });
      return ApiErrors.databaseError('Failed to unsubscribe');
    }

    if (flowResult.error) {
      // Log but don't fail — the subscriber is already unsubscribed
      logApiError('email/subscribers/delete/flow-contacts', flowResult.error, { id, teamId });
    }

    return NextResponse.json({ message: 'Subscriber unsubscribed' });
  } catch (error) {
    logApiError('email/subscribers/delete', error);
    return ApiErrors.internalError('Failed to unsubscribe');
  }
}
