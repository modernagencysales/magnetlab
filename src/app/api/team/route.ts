import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { logTeamActivity } from '@/lib/utils/activity-log';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { sendEmail } from '@/lib/integrations/resend';

import { logError } from '@/lib/utils/logger';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('team_members')
    .select('id, email, status, invited_at, accepted_at, member_id')
    .eq('owner_id', session.user.id)
    .neq('status', 'removed')
    .order('invited_at', { ascending: false });

  if (error) {
    logApiError('team-list', error, { userId: session.user.id });
    return ApiErrors.databaseError();
  }

  // Fetch member names for accepted members
  const memberIds = data.filter(m => m.member_id).map(m => m.member_id);
  let memberMap: Record<string, { name: string | null; avatar_url: string | null }> = {};

  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', memberIds);

    if (members) {
      memberMap = Object.fromEntries(
        members.map(m => [m.id, { name: m.name, avatar_url: m.avatar_url }])
      );
    }
  }

  const enriched = data.map(m => ({
    ...m,
    memberName: m.member_id ? memberMap[m.member_id]?.name : null,
    memberAvatar: m.member_id ? memberMap[m.member_id]?.avatar_url : null,
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return ApiErrors.validationError('Valid email is required');
  }

  // Don't let owner invite themselves
  if (email === session.user.email?.toLowerCase()) {
    return ApiErrors.validationError('You cannot invite yourself');
  }

  const supabase = createSupabaseAdminClient();

  // RBAC: Verify user is team owner
  const { data: ownerTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .single();

  if (ownerTeam) {
    const role = await checkTeamRole(session.user.id, ownerTeam.id);
    if (!hasMinimumRole(role, 'owner')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  // Check if already invited
  const { data: existing } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('owner_id', session.user.id)
    .eq('email', email)
    .single();

  if (existing && existing.status !== 'removed') {
    return ApiErrors.conflict('This email has already been invited');
  }

  // Check if a user with this email already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  const memberData: Record<string, unknown> = {
    owner_id: session.user.id,
    email,
    status: existingUser ? 'active' : 'pending',
    member_id: existingUser?.id || null,
    accepted_at: existingUser ? new Date().toISOString() : null,
  };

  // Upsert (handles re-inviting removed members)
  if (existing) {
    const { error } = await supabase
      .from('team_members')
      .update(memberData)
      .eq('id', existing.id);

    if (error) {
      logApiError('team-reinvite', error, { userId: session.user.id, email });
      return ApiErrors.databaseError();
    }
  } else {
    const { error } = await supabase
      .from('team_members')
      .insert(memberData);

    if (error) {
      logApiError('team-invite', error, { userId: session.user.id, email });
      return ApiErrors.databaseError();
    }
  }

  // Send invite email (fire-and-forget)
  const ownerName = session.user.name || session.user.email || 'Someone';
  sendEmail({
    to: email,
    subject: `${ownerName} invited you to their MagnetLab team`,
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 20px;">
        <h2 style="margin: 0 0 16px;">${ownerName} invited you to their team</h2>
        <p style="color: #666; line-height: 1.6;">
          You've been invited to view ${ownerName}'s lead magnet catalog on MagnetLab.
          ${existingUser ? 'Log in to your existing account to get started.' : 'Create an account with this email to get started.'}
        </p>
        <a href="${process.env.NEXTAUTH_URL || 'https://magnetlab.app'}/login"
           style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
          ${existingUser ? 'Log In' : 'Create Account'}
        </a>
      </div>
    `,
  }).catch(err => logError('api/team', err, { step: 'send_invite_email' }));

  // Log activity (fire-and-forget)
  if (ownerTeam) {
    logTeamActivity({
      teamId: ownerTeam.id,
      userId: session.user.id,
      action: 'member.invited',
      targetType: 'member',
      targetId: email,
      details: { email, autoLinked: !!existingUser },
    });
  }

  return NextResponse.json({ success: true, autoLinked: !!existingUser }, { status: 201 });
}
