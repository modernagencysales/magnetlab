import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getTeamOwnerFromProfile } from '@/lib/utils/team-membership';
import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { logTeamActivity } from '@/lib/utils/activity-log';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

// PATCH /api/teams/profiles/[id] — update a profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const { id } = await params;
  if (!isValidUUID(id)) return ApiErrors.validationError('Invalid profile ID');

  let body: {
    full_name?: string;
    title?: string;
    email?: string;
    linkedin_url?: string;
    bio?: string;
    expertise_areas?: string[];
    voice_profile?: Record<string, unknown>;
    avatar_url?: string;
  };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Verify ownership: profile must belong to user's team
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('id, team_id, user_id, teams(owner_id)')
    .eq('id', id)
    .single();

  if (!profile) return ApiErrors.notFound('Profile');

  const teamOwner = getTeamOwnerFromProfile(profile);
  if (teamOwner !== userId) {
    // Not the team owner — check if editing own profile (member allowed)
    const role = await checkTeamRole(userId, profile.team_id);
    const isOwnProfile = profile.user_id === userId;
    if (isOwnProfile && hasMinimumRole(role, 'member')) {
      // Member editing their own profile — allowed
    } else {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.full_name !== undefined) updates.full_name = body.full_name.trim();
  if (body.title !== undefined) updates.title = body.title?.trim() || null;
  if (body.email !== undefined) updates.email = body.email?.trim().toLowerCase() || null;
  if (body.linkedin_url !== undefined) updates.linkedin_url = body.linkedin_url?.trim() || null;
  if (body.bio !== undefined) updates.bio = body.bio?.trim() || null;
  if (body.expertise_areas !== undefined) updates.expertise_areas = body.expertise_areas;
  if (body.voice_profile !== undefined) updates.voice_profile = body.voice_profile;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url?.trim() || null;

  const { data: updated, error } = await supabase
    .from('team_profiles')
    .update(updates)
    .eq('id', id)
    .select('id, team_id, user_id, email, full_name, title, linkedin_url, bio, expertise_areas, voice_profile, avatar_url, role, status, is_default, invited_at, accepted_at, created_at, updated_at')
    .single();

  if (error) {
    logApiError('profiles-update', error, { userId, profileId: id });
    return ApiErrors.databaseError();
  }

  // Log activity (fire-and-forget)
  logTeamActivity({
    teamId: profile.team_id,
    userId,
    action: 'profile.updated',
    targetType: 'profile',
    targetId: id,
    details: { updatedFields: Object.keys(updates).filter(k => k !== 'updated_at') },
  });

  return NextResponse.json({ profile: updated });
}

// DELETE /api/teams/profiles/[id] — remove a profile (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const { id } = await params;
  if (!isValidUUID(id)) return ApiErrors.validationError('Invalid profile ID');

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Verify ownership
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('id, role, team_id, teams(owner_id)')
    .eq('id', id)
    .single();

  if (!profile) return ApiErrors.notFound('Profile');

  // RBAC: Require owner role to delete profiles
  const role = await checkTeamRole(userId, profile.team_id);
  if (!hasMinimumRole(role, 'owner')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Cannot remove the owner profile
  if (profile.role === 'owner') {
    return ApiErrors.validationError('Cannot remove the team owner profile');
  }

  const { error } = await supabase
    .from('team_profiles')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    logApiError('profiles-delete', error, { userId, profileId: id });
    return ApiErrors.databaseError();
  }

  // Log activity (fire-and-forget)
  logTeamActivity({
    teamId: profile.team_id,
    userId,
    action: 'profile.removed',
    targetType: 'profile',
    targetId: id,
  });

  return NextResponse.json({ success: true });
}
