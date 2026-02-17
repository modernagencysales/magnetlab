import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { logTeamActivity } from '@/lib/utils/activity-log';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getMergedMemberships } from '@/lib/utils/team-membership';

const TEAM_SELECT = 'id, owner_id, name, description, industry, target_audience, shared_goal, created_at, updated_at';

// GET /api/teams — fetch all teams the user owns + is a member of
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const memberships = await getMergedMemberships(session.user.id);

  const owned = memberships.filter(m => m.role === 'owner');
  const member = memberships.filter(m => m.role === 'member');

  return NextResponse.json({ owned, member });
}

// POST /api/teams — create a new team (multiple allowed)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  let body: { name?: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  const name = body.name?.trim();
  if (!name) {
    return ApiErrors.validationError('Team name is required');
  }

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Create team (no single-team restriction)
  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      owner_id: userId,
      name,
      description: body.description?.trim() || null,
      industry: body.industry?.trim() || null,
      target_audience: body.target_audience?.trim() || null,
      shared_goal: body.shared_goal?.trim() || null,
    })
    .select(TEAM_SELECT)
    .single();

  if (error) {
    logApiError('teams-create', error, { userId });
    return ApiErrors.databaseError();
  }

  // Auto-create default profile for owner
  const { data: user } = await supabase
    .from('users')
    .select('email, name, avatar_url')
    .eq('id', userId)
    .single();

  await supabase
    .from('team_profiles')
    .insert({
      team_id: team.id,
      user_id: userId,
      email: user?.email || session.user.email,
      full_name: user?.name || session.user.name || 'Owner',
      role: 'owner',
      status: 'active',
      is_default: true,
      accepted_at: new Date().toISOString(),
    });

  return NextResponse.json({ team }, { status: 201 });
}

// PATCH /api/teams — update team settings (requires team_id in body)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  let body: { team_id?: string; name?: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  if (!body.team_id) {
    return ApiErrors.validationError('team_id is required');
  }

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // RBAC: Verify user is team owner
  const role = await checkTeamRole(userId, body.team_id);
  if (!hasMinimumRole(role, 'owner')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.industry !== undefined) updates.industry = body.industry?.trim() || null;
  if (body.target_audience !== undefined) updates.target_audience = body.target_audience?.trim() || null;
  if (body.shared_goal !== undefined) updates.shared_goal = body.shared_goal?.trim() || null;

  const { data: team, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', body.team_id)
    .select(TEAM_SELECT)
    .single();

  if (error) {
    logApiError('teams-update', error, { userId });
    return ApiErrors.databaseError();
  }

  // Log activity (fire-and-forget)
  if (team) {
    logTeamActivity({
      teamId: team.id,
      userId,
      action: 'team.updated',
      targetType: 'team',
      targetId: team.id,
      details: { updatedFields: Object.keys(updates).filter(k => k !== 'updated_at') },
    });
  }

  return NextResponse.json({ team });
}
