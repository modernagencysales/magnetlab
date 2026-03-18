/**
 * Team Repository
 * Supabase queries for teams, team_members (access), team_profiles (identity),
 * team_links (agency-to-client), and team activity.
 * Never imported by 'use client' files. Uses createSupabaseAdminClient() only.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { Team, TeamMember, TeamLink, TeamProfile } from '@/lib/types/content-pipeline';

// ─── Update field whitelists ────────────────────────────────────────────────

const ALLOWED_TEAM_UPDATE_FIELDS = ['name', 'description', 'industry', 'target_audience', 'shared_goal', 'billing_team_id'] as const;

const ALLOWED_PROFILE_UPDATE_FIELDS = ['full_name', 'email', 'title', 'linkedin_url', 'bio', 'expertise_areas', 'voice_profile', 'avatar_url', 'is_default', 'status'] as const;

// ─── Column select constants ────────────────────────────────────────────────

const TEAM_SELECT =
  'id, owner_id, name, description, industry, target_audience, shared_goal, billing_team_id, created_at, updated_at';

const TEAM_MEMBER_SELECT = 'id, team_id, user_id, role, status, joined_at';

const TEAM_LINK_SELECT = 'id, agency_team_id, client_team_id, created_at';

const TEAM_PROFILE_SELECT =
  'id, team_id, user_id, email, full_name, title, linkedin_url, bio, expertise_areas, voice_profile, avatar_url, status, is_default, created_at, updated_at';

// ─── Result types ───────────────────────────────────────────────────────────

export interface TeamAccessResult {
  access: boolean;
  role: 'owner' | 'member';
  via: 'direct' | 'team_link';
}

export interface UserTeamEntry {
  team: Team;
  role: 'owner' | 'member';
  via: 'direct' | 'team_link';
}

// ─── Legacy types (kept for existing callers) ───────────────────────────────

export interface TeamProfileRow {
  id: string;
  full_name: string | null;
  voice_profile: unknown;
}

export interface TeamActivityRow {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: unknown;
  created_at: string;
}

// ─── Access control — hasTeamAccess ─────────────────────────────────────────

/**
 * THE core access check. Determines if a user can work in a team.
 * Checks direct membership first, then agency team links.
 * Direct membership returns the user's actual role; link access returns 'member'.
 */
export async function hasTeamAccess(
  userId: string,
  teamId: string
): Promise<TeamAccessResult> {
  const supabase = createSupabaseAdminClient();

  // 1. Direct membership check
  const { data: direct } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (direct) {
    return { access: true, role: direct.role as 'owner' | 'member', via: 'direct' };
  }

  // 2. Team link check — user is member of an agency team linked to this team
  // Two-step: find agency teams linked to this client team, then check membership.
  // Can't use PostgREST join because team_links → team_members has no direct FK.
  const { data: links } = await supabase
    .from('team_links')
    .select('agency_team_id')
    .eq('client_team_id', teamId);

  const agencyIds = (links ?? []).map((l) => l.agency_team_id);

  if (agencyIds.length > 0) {
    const { data: linkedMember } = await supabase
      .from('team_members')
      .select('id')
      .in('team_id', agencyIds)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (linkedMember) {
      return { access: true, role: 'member', via: 'team_link' };
    }
  }

  // No access
  return { access: false, role: 'member', via: 'direct' };
}

// ─── Access control — getUserTeams ──────────────────────────────────────────

/**
 * Returns all teams a user can access, for the team switcher.
 * Includes direct memberships and teams accessible via agency team links.
 * Deduplicates — prefers direct membership over linked access.
 */
export async function getUserTeams(userId: string): Promise<UserTeamEntry[]> {
  const supabase = createSupabaseAdminClient();

  // 1. Direct memberships
  const { data: directRows, error: directErr } = await supabase
    .from('team_members')
    .select(`role, teams!inner(${TEAM_SELECT})`)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (directErr) throw new Error(`team.getUserTeams direct: ${directErr.message}`);

  const result: UserTeamEntry[] = [];
  const seenTeamIds = new Set<string>();

  for (const row of directRows ?? []) {
    const team = row.teams as unknown as Team;
    seenTeamIds.add(team.id);
    result.push({ team, role: row.role as 'owner' | 'member', via: 'direct' });
  }

  // 2. Linked teams via agency team links
  // Get agency teams the user belongs to
  const { data: agencyMemberships } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  const agencyTeamIds = (agencyMemberships ?? []).map((m) => m.team_id);

  if (agencyTeamIds.length > 0) {
    const { data: linkRows, error: linkErr } = await supabase
      .from('team_links')
      .select(`client_team_id, teams!team_links_client_team_id_fkey(${TEAM_SELECT})`)
      .in('agency_team_id', agencyTeamIds);

    if (linkErr) throw new Error(`team.getUserTeams links: ${linkErr.message}`);

    for (const row of linkRows ?? []) {
      if (seenTeamIds.has(row.client_team_id)) continue; // prefer direct
      seenTeamIds.add(row.client_team_id);
      const team = row.teams as unknown as Team;
      result.push({ team, role: 'member', via: 'team_link' });
    }
  }

  return result;
}

// ─── Member CRUD ────────────────────────────────────────────────────────────

/** Add a member to a team. Inserts into team_members with status='active'. */
export async function addMember(
  teamId: string,
  userId: string,
  role: 'owner' | 'member'
): Promise<TeamMember> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      user_id: userId,
      role,
      status: 'active',
    })
    .select(TEAM_MEMBER_SELECT)
    .single();
  if (error) throw new Error(`team.addMember: ${error.message}`);
  return data as TeamMember;
}

/** Soft-remove a member by setting status='removed'. Does not hard-delete. */
export async function removeMember(teamId: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('team_members')
    .update({ status: 'removed' })
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) throw new Error(`team.removeMember: ${error.message}`);
}

/** List active members of a team. */
export async function listMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_members')
    .select(TEAM_MEMBER_SELECT)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });
  if (error) throw new Error(`team.listMembers: ${error.message}`);
  return (data ?? []) as TeamMember[];
}

// ─── Team Links CRUD ────────────────────────────────────────────────────────

/** Create an agency-to-client team link. */
export async function createTeamLink(
  agencyTeamId: string,
  clientTeamId: string
): Promise<TeamLink> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_links')
    .insert({ agency_team_id: agencyTeamId, client_team_id: clientTeamId })
    .select(TEAM_LINK_SELECT)
    .single();
  if (error) throw new Error(`team.createTeamLink: ${error.message}`);
  return data as TeamLink;
}

/** Get a team link by ID. Returns null if not found. */
export async function getTeamLinkById(linkId: string): Promise<TeamLink | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_links')
    .select(TEAM_LINK_SELECT)
    .eq('id', linkId)
    .maybeSingle();
  return (data as TeamLink) ?? null;
}

/** Delete a team link by ID. */
export async function deleteTeamLink(linkId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('team_links')
    .delete()
    .eq('id', linkId);
  if (error) throw new Error(`team.deleteTeamLink: ${error.message}`);
}

/** List team links where the given team is agency or client. */
export async function listTeamLinks(teamId: string): Promise<TeamLink[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_links')
    .select(TEAM_LINK_SELECT)
    .or(`agency_team_id.eq.${teamId},client_team_id.eq.${teamId}`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`team.listTeamLinks: ${error.message}`);
  return (data ?? []) as TeamLink[];
}

// ─── Profile helpers (identity, not access) ─────────────────────────────────

/** Get active team profiles — the "post as" options for the team. */
export async function getTeamProfiles(teamId: string): Promise<TeamProfile[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .select(TEAM_PROFILE_SELECT)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`team.getTeamProfiles: ${error.message}`);
  return (data ?? []) as unknown as TeamProfile[];
}

/** Get the default profile (is_default=true) for a team. Returns null if none. */
export async function getDefaultProfile(teamId: string): Promise<TeamProfile | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select(TEAM_PROFILE_SELECT)
    .eq('team_id', teamId)
    .eq('is_default', true)
    .eq('status', 'active')
    .maybeSingle();
  return (data as unknown as TeamProfile) ?? null;
}

/** Get string[] of active profile IDs for a team. Used for scoping queries. */
export async function getTeamProfileIds(teamId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('team_id', teamId)
    .eq('status', 'active');
  return (data ?? []).map((p) => p.id);
}

// ─── Existing profile queries (kept for callers) ───────────────────────────

/** Single profile: full_name, title, voice_profile (for quick-write voice options). */
export async function findProfileVoiceAndName(
  profileId: string
): Promise<{ full_name: string | null; title: string | null; voice_profile: unknown } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('full_name, title, voice_profile')
    .eq('id', profileId)
    .single();
  return data;
}

/** Active team profiles with voice_profile (for admin learning). */
export async function findActiveProfilesWithVoice(): Promise<TeamProfileRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .select('id, full_name, voice_profile')
    .eq('status', 'active');
  if (error) throw new Error(`team.findActiveProfilesWithVoice: ${error.message}`);
  return (data ?? []) as TeamProfileRow[];
}

// ─── Users helpers ──────────────────────────────────────────────────────────

export async function getUsersByIds(
  userIds: string[]
): Promise<Record<string, { name: string | null; avatar_url: string | null }>> {
  if (userIds.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds);
  const map: Record<string, { name: string | null; avatar_url: string | null }> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; name: string | null; avatar_url: string | null };
    map[r.id] = { name: r.name, avatar_url: r.avatar_url };
  }
  return map;
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('id').eq('email', email).single();
  return data ? (data as { id: string }).id : null;
}

export async function getUserIdByEmailForProfile(email: string): Promise<string | null> {
  return getUserIdByEmail(email);
}

// ─── Teams CRUD ─────────────────────────────────────────────────────────────

export async function getTeamById(teamId: string): Promise<Team | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SELECT)
    .eq('id', teamId)
    .single();
  if (error || !data) return null;
  return data as unknown as Team;
}

export async function getOwnerTeamByUserId(userId: string): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('teams').select('id').eq('owner_id', userId).single();
  return data as { id: string } | null;
}

/**
 * Get team_id for a user via team_members (owner role).
 * Replaces getTeamIdByOwnerProfileUserId which used team_profiles.role.
 */
export async function getTeamIdByOwnerProfileUserId(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return data?.team_id ?? null;
}

/**
 * Get the owner profile id for a user.
 * Uses team_members to find the team, then gets the default profile.
 */
export async function getOwnerProfileIdByUserId(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();

  // Find the team the user owns via team_members
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  // Find a profile linked to this user in that team
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('team_id', membership.team_id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  return profile?.id ?? null;
}

export async function createTeam(
  ownerId: string,
  payload: {
    name: string;
    description?: string | null;
    industry?: string | null;
    target_audience?: string | null;
    shared_goal?: string | null;
  }
): Promise<Team> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .insert({
      owner_id: ownerId,
      name: payload.name,
      description: payload.description ?? null,
      industry: payload.industry ?? null,
      target_audience: payload.target_audience ?? null,
      shared_goal: payload.shared_goal ?? null,
    })
    .select(TEAM_SELECT)
    .single();
  if (error) throw new Error(`team.createTeam: ${error.message}`);
  return data as unknown as Team;
}

export async function updateTeam(
  teamId: string,
  updates: Record<string, unknown>
): Promise<Team> {
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_TEAM_UPDATE_FIELDS) {
    if (key in updates) filtered[key] = updates[key];
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .update(filtered)
    .eq('id', teamId)
    .select(TEAM_SELECT)
    .single();
  if (error) throw new Error(`team.updateTeam: ${error.message}`);
  return data as unknown as Team;
}

// ─── Team profiles CRUD ─────────────────────────────────────────────────────

/**
 * Add owner profile when creating a team.
 * Profiles no longer have role/invited_at/accepted_at — those are on team_members.
 */
export async function addOwnerProfile(
  teamId: string,
  userId: string,
  email: string | null,
  fullName: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('team_profiles').insert({
    team_id: teamId,
    user_id: userId,
    email,
    full_name: fullName,
    status: 'active',
    is_default: true,
  });
  if (error) throw new Error(`team.addOwnerProfile: ${error.message}`);
}

/** Insert owner team profile with optional linkedin_url/title (for external create-account). */
export async function insertOwnerProfileForExternal(payload: {
  team_id: string;
  user_id: string;
  email: string;
  full_name: string;
  linkedin_url?: string | null;
  title?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('team_profiles').insert({
    team_id: payload.team_id,
    user_id: payload.user_id,
    email: payload.email,
    full_name: payload.full_name,
    linkedin_url: payload.linkedin_url ?? null,
    title: payload.title ?? null,
    status: 'active',
    is_default: true,
  });
  if (error) throw new Error(`team.insertOwnerProfileForExternal: ${error.message}`);
}

export async function listProfilesByTeamId(teamId: string): Promise<TeamProfile[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .select(TEAM_PROFILE_SELECT)
    .eq('team_id', teamId)
    .neq('status', 'removed')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`team.listProfilesByTeamId: ${error.message}`);
  return (data ?? []) as unknown as TeamProfile[];
}

export async function getProfileByIdWithTeam(
  profileId: string
): Promise<{ id: string; team_id: string; user_id: string | null; teams?: { owner_id: string } } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('id, team_id, user_id, teams(owner_id)')
    .eq('id', profileId)
    .single();
  return data as { id: string; team_id: string; user_id: string | null; teams?: { owner_id: string } } | null;
}

export async function getProfileByIdForDelete(
  profileId: string
): Promise<{ id: string; team_id: string; user_id: string | null; teams?: { owner_id: string } } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('id, team_id, user_id, teams(owner_id)')
    .eq('id', profileId)
    .single();
  return data as { id: string; team_id: string; user_id: string | null; teams?: { owner_id: string } } | null;
}

export async function createTeamProfile(
  teamId: string,
  payload: Record<string, unknown>
): Promise<TeamProfile> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .insert({ team_id: teamId, ...payload })
    .select(TEAM_PROFILE_SELECT)
    .single();
  if (error) throw new Error(`team.createTeamProfile: ${error.message}`);
  return data as unknown as TeamProfile;
}

export async function updateTeamProfile(
  profileId: string,
  updates: Record<string, unknown>
): Promise<TeamProfile> {
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_PROFILE_UPDATE_FIELDS) {
    if (key in updates) filtered[key] = updates[key];
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .update(filtered)
    .eq('id', profileId)
    .select(TEAM_PROFILE_SELECT)
    .single();
  if (error) throw new Error(`team.updateTeamProfile: ${error.message}`);
  return data as unknown as TeamProfile;
}

export async function setTeamProfileRemoved(profileId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('team_profiles')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', profileId);
  if (error) throw new Error(`team.setTeamProfileRemoved: ${error.message}`);
}

export async function findProfileByTeamAndEmail(
  teamId: string,
  email: string
): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('team_id', teamId)
    .eq('email', email)
    .single();
  return data as { id: string } | null;
}

/** Soft-remove team_profiles by team_id and user_id. */
export async function setTeamProfilesRemovedByUserId(
  teamId: string,
  userId: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('team_profiles')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('user_id', userId);
}

export async function setTeamProfilesRemovedByEmail(
  teamId: string,
  email: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('team_profiles')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('email', email);
}

// ─── Team activity log ──────────────────────────────────────────────────────

export async function getTeamActivityCount(teamId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('team_activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);
  if (error) throw new Error(`team.getTeamActivityCount: ${error.message}`);
  return count ?? 0;
}

export async function listTeamActivity(
  teamId: string,
  limit: number,
  offset: number
): Promise<TeamActivityRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_activity_log')
    .select('id, user_id, action, target_type, target_id, details, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`team.listTeamActivity: ${error.message}`);
  return (data ?? []) as TeamActivityRow[];
}
