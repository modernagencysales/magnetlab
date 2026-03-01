/**
 * Teams Service (teams + team_profiles)
 * List memberships, create/update team, list/create/update/delete profiles.
 */

import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { logTeamActivity } from '@/lib/utils/activity-log';
import { getMergedMemberships } from '@/lib/utils/team-membership';
import { getTeamOwnerFromProfile } from '@/lib/utils/team-membership';
import * as teamRepo from '@/server/repositories/team.repo';

export async function listTeams(userId: string) {
  const memberships = await getMergedMemberships(userId);
  const owned = memberships.filter((m) => m.role === 'owner');
  const member = memberships.filter((m) => m.role === 'member');
  return { owned, member };
}

export async function createTeam(
  userId: string,
  payload: { name: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string },
  userEmail: string | null,
  userName: string | null,
) {
  const team = await teamRepo.createTeam(userId, {
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    industry: payload.industry?.trim() || null,
    target_audience: payload.target_audience?.trim() || null,
    shared_goal: payload.shared_goal?.trim() || null,
  });
  const teamId = (team.id as string);
  await teamRepo.addOwnerProfile(
    teamId,
    userId,
    userEmail,
    userName || 'Owner',
  );
  return { team };
}

export async function updateTeam(
  userId: string,
  teamId: string,
  payload: { name?: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string },
) {
  const role = await checkTeamRole(userId, teamId);
  if (!hasMinimumRole(role, 'owner')) return { error: 'FORBIDDEN' as const };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.description !== undefined) updates.description = payload.description?.trim() || null;
  if (payload.industry !== undefined) updates.industry = payload.industry?.trim() || null;
  if (payload.target_audience !== undefined) updates.target_audience = payload.target_audience?.trim() || null;
  if (payload.shared_goal !== undefined) updates.shared_goal = payload.shared_goal?.trim() || null;

  const team = await teamRepo.updateTeam(teamId, updates);
  logTeamActivity({
    teamId,
    userId,
    action: 'team.updated',
    targetType: 'team',
    targetId: teamId,
    details: { updatedFields: Object.keys(updates).filter((k) => k !== 'updated_at') },
  });
  return { team };
}

export async function listProfiles(userId: string) {
  const team = await teamRepo.getOwnerTeamByUserId(userId);
  if (!team) return { profiles: [] };
  const profiles = await teamRepo.listProfilesByTeamId(team.id);
  return { profiles };
}

export async function createProfile(
  userId: string,
  payload: {
    full_name: string;
    email?: string | null;
    title?: string | null;
    linkedin_url?: string | null;
    bio?: string | null;
    expertise_areas?: string[];
    voice_profile?: Record<string, unknown>;
  },
) {
  const team = await teamRepo.getOwnerTeamByUserId(userId);
  if (!team) return { error: 'NOT_FOUND' as const };

  const role = await checkTeamRole(userId, team.id);
  if (!hasMinimumRole(role, 'owner')) return { error: 'FORBIDDEN' as const };

  const email = payload.email?.trim().toLowerCase() || null;
  if (email) {
    const existing = await teamRepo.findProfileByTeamAndEmail(team.id, email);
    if (existing) return { error: 'CONFLICT' as const };
  }

  let linkedUserId: string | null = null;
  if (email) linkedUserId = await teamRepo.getUserIdByEmailForProfile(email);

  const profile = await teamRepo.createTeamProfile(team.id, {
    user_id: linkedUserId,
    email,
    full_name: payload.full_name.trim(),
    title: payload.title?.trim() || null,
    linkedin_url: payload.linkedin_url?.trim() || null,
    bio: payload.bio?.trim() || null,
    expertise_areas: payload.expertise_areas || [],
    voice_profile: payload.voice_profile || {},
    role: 'member',
    status: linkedUserId ? 'active' : 'pending',
    invited_at: new Date().toISOString(),
    accepted_at: linkedUserId ? new Date().toISOString() : null,
  });

  logTeamActivity({
    teamId: team.id,
    userId,
    action: 'profile.created',
    targetType: 'profile',
    targetId: profile.id as string,
    details: { fullName: payload.full_name, email },
  });
  return { profile };
}

export async function updateProfile(
  userId: string,
  profileId: string,
  payload: {
    full_name?: string;
    title?: string | null;
    email?: string | null;
    linkedin_url?: string | null;
    bio?: string | null;
    expertise_areas?: string[];
    voice_profile?: Record<string, unknown>;
    avatar_url?: string | null;
  },
) {
  const profile = await teamRepo.getProfileByIdWithTeam(profileId);
  if (!profile) return { error: 'NOT_FOUND' as const };

  const teamOwner = getTeamOwnerFromProfile(profile);
  if (teamOwner !== userId) {
    const role = await checkTeamRole(userId, profile.team_id);
    const isOwnProfile = profile.user_id === userId;
    if (!(isOwnProfile && hasMinimumRole(role, 'member'))) {
      return { error: 'FORBIDDEN' as const };
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.full_name !== undefined) updates.full_name = payload.full_name.trim();
  if (payload.title !== undefined) updates.title = payload.title?.trim() || null;
  if (payload.email !== undefined) updates.email = payload.email?.trim().toLowerCase() || null;
  if (payload.linkedin_url !== undefined) updates.linkedin_url = payload.linkedin_url?.trim() || null;
  if (payload.bio !== undefined) updates.bio = payload.bio?.trim() || null;
  if (payload.expertise_areas !== undefined) updates.expertise_areas = payload.expertise_areas;
  if (payload.voice_profile !== undefined) updates.voice_profile = payload.voice_profile;
  if (payload.avatar_url !== undefined) updates.avatar_url = payload.avatar_url?.trim() || null;

  const updated = await teamRepo.updateTeamProfile(profileId, updates);
  logTeamActivity({
    teamId: profile.team_id,
    userId,
    action: 'profile.updated',
    targetType: 'profile',
    targetId: profileId,
    details: { updatedFields: Object.keys(updates).filter((k) => k !== 'updated_at') },
  });
  return { profile: updated };
}

export async function deleteProfile(userId: string, profileId: string) {
  const profile = await teamRepo.getProfileByIdForDelete(profileId);
  if (!profile) return { error: 'NOT_FOUND' as const };

  const role = await checkTeamRole(userId, profile.team_id);
  if (!hasMinimumRole(role, 'owner')) return { error: 'FORBIDDEN' as const };
  if (profile.role === 'owner') return { error: 'VALIDATION' as const, message: 'Cannot remove the team owner profile' };

  await teamRepo.setTeamProfileRemoved(profileId);
  logTeamActivity({
    teamId: profile.team_id,
    userId,
    action: 'profile.removed',
    targetType: 'profile',
    targetId: profileId,
  });
  return { success: true };
}
