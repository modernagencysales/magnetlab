/**
 * Teams Service (teams + team_profiles + team_links)
 * List memberships, create/update team, list/create/update/delete profiles.
 * CRUD for agency-to-client team links.
 * Uses getUserTeams() + hasTeamAccess() from team.repo — no getMergedMemberships().
 */

import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { logTeamActivity } from '@/lib/utils/activity-log';
import * as teamRepo from '@/server/repositories/team.repo';

/** Extract owner_id from a Supabase team_profiles row that joins teams. */
function getTeamOwnerFromProfile(profile: { teams?: unknown }): string | null {
  const teams = profile.teams as { owner_id?: string } | null;
  return teams?.owner_id ?? null;
}

export async function listTeams(userId: string) {
  const entries = await teamRepo.getUserTeams(userId);
  const owned = entries.filter((e) => e.role === 'owner');
  const member = entries.filter((e) => e.role === 'member');
  // Flat `teams` array for MCP tools — each entry has id, name, role
  const teams = entries.map((e) => ({
    id: e.team.id,
    name: e.team.name,
    role: e.role,
  }));
  return { owned, member, teams };
}

export async function createTeam(
  userId: string,
  payload: {
    name: string;
    description?: string;
    industry?: string;
    target_audience?: string;
    shared_goal?: string;
  },
  userEmail: string | null,
  userName: string | null
) {
  const team = await teamRepo.createTeam(userId, {
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    industry: payload.industry?.trim() || null,
    target_audience: payload.target_audience?.trim() || null,
    shared_goal: payload.shared_goal?.trim() || null,
  });
  const teamId = team.id as string;
  // Register owner in team_members (access table) and create owner identity profile
  await teamRepo.addMember(teamId, userId, 'owner');
  await teamRepo.addOwnerProfile(teamId, userId, userEmail, userName || 'Owner');
  return { team };
}

export async function updateTeam(
  userId: string,
  teamId: string,
  payload: {
    name?: string;
    description?: string;
    industry?: string;
    target_audience?: string;
    shared_goal?: string;
  }
) {
  const role = await checkTeamRole(userId, teamId);
  if (!hasMinimumRole(role, 'owner')) return { error: 'FORBIDDEN' as const };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.description !== undefined) updates.description = payload.description?.trim() || null;
  if (payload.industry !== undefined) updates.industry = payload.industry?.trim() || null;
  if (payload.target_audience !== undefined)
    updates.target_audience = payload.target_audience?.trim() || null;
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
  }
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
    // role, invited_at, accepted_at moved to team_members — not on team_profiles in V3
    status: linkedUserId ? 'active' : 'pending',
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
  }
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
  if (payload.linkedin_url !== undefined)
    updates.linkedin_url = payload.linkedin_url?.trim() || null;
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

// ─── Team Links ──────────────────────────────────────────────────────────────

export async function listTeamLinks(userId: string) {
  const ownedTeam = await teamRepo.getOwnerTeamByUserId(userId);
  if (!ownedTeam) return { links: [] };
  const links = await teamRepo.listTeamLinks(ownedTeam.id);
  return { links };
}

export async function createTeamLink(
  userId: string,
  agencyTeamId: string,
  clientTeamId: string
) {
  if (agencyTeamId === clientTeamId) {
    throw Object.assign(new Error('Agency and client teams must be different'), { statusCode: 400 });
  }

  const access = await teamRepo.hasTeamAccess(userId, agencyTeamId);
  if (!access.access || access.role !== 'owner' || access.via !== 'direct') {
    throw Object.assign(new Error('Must be agency team owner to create a link'), { statusCode: 403 });
  }

  const agencyTeam = await teamRepo.getTeamById(agencyTeamId);
  if (!agencyTeam) throw Object.assign(new Error('Agency team not found'), { statusCode: 404 });

  const clientTeam = await teamRepo.getTeamById(clientTeamId);
  if (!clientTeam) throw Object.assign(new Error('Client team not found'), { statusCode: 404 });

  const link = await teamRepo.createTeamLink(agencyTeamId, clientTeamId);
  return { link };
}

export async function deleteTeamLink(userId: string, linkId: string) {
  const link = await teamRepo.getTeamLinkById(linkId);
  if (!link) throw Object.assign(new Error('Team link not found'), { statusCode: 404 });

  const agencyAccess = await teamRepo.hasTeamAccess(userId, link.agency_team_id);
  const clientAccess = await teamRepo.hasTeamAccess(userId, link.client_team_id);

  const isAgencyOwner =
    agencyAccess.access && agencyAccess.role === 'owner' && agencyAccess.via === 'direct';
  const isClientOwner =
    clientAccess.access && clientAccess.role === 'owner' && clientAccess.via === 'direct';

  if (!isAgencyOwner && !isClientOwner) {
    throw Object.assign(new Error('Must be owner of either team to remove a link'), {
      statusCode: 403,
    });
  }

  await teamRepo.deleteTeamLink(linkId);
  return { success: true };
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export async function deleteProfile(userId: string, profileId: string) {
  const profile = await teamRepo.getProfileByIdForDelete(profileId);
  if (!profile) return { error: 'NOT_FOUND' as const };

  const role = await checkTeamRole(userId, profile.team_id);
  if (!hasMinimumRole(role, 'owner')) return { error: 'FORBIDDEN' as const };

  // role was dropped from team_profiles in V3 — protect owner profiles via teams.owner_id
  const teamOwnerId = getTeamOwnerFromProfile(profile);
  if (teamOwnerId && profile.user_id === teamOwnerId)
    return { error: 'VALIDATION' as const, message: 'Cannot remove the team owner profile' };

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
