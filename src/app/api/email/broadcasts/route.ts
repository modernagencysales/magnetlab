// API Route: Email Broadcasts
// GET — List broadcasts for team
// POST — Create a draft broadcast

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createBroadcastSchema } from '@/lib/types/email-system';

const BROADCAST_COLUMNS =
  'id, team_id, user_id, subject, body, status, audience_filter, recipient_count, sent_at, created_at, updated_at';

// GET — List broadcasts for team, ordered by created_at desc
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    const { data: broadcasts, error } = await supabase
      .from('email_broadcasts')
      .select(BROADCAST_COLUMNS)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      logApiError('email/broadcasts/list', error, { teamId });
      return ApiErrors.databaseError('Failed to list broadcasts');
    }

    return NextResponse.json({ broadcasts: broadcasts ?? [] });
  } catch (error) {
    logApiError('email/broadcasts/list', error);
    return ApiErrors.internalError('Failed to list broadcasts');
  }
}

// POST — Create a draft broadcast
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = createBroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid broadcast data',
        parsed.error.issues
      );
    }

    const { subject, body: emailBody } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    const { data: broadcast, error } = await supabase
      .from('email_broadcasts')
      .insert({
        team_id: teamId,
        user_id: session.user.id,
        subject: subject || '',
        body: emailBody || '',
        status: 'draft',
        recipient_count: 0,
      })
      .select(BROADCAST_COLUMNS)
      .single();

    if (error) {
      logApiError('email/broadcasts/create', error, { teamId });
      return ApiErrors.databaseError('Failed to create broadcast');
    }

    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error) {
    logApiError('email/broadcasts/create', error);
    return ApiErrors.internalError('Failed to create broadcast');
  }
}
