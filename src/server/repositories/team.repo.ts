/**
 * Team / Team Profiles Repository
 * Supabase queries for teams and team_profiles used by server.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

export interface TeamProfileRow {
  id: string;
  full_name: string | null;
  voice_profile: unknown;
}

/** Single profile: full_name, title, voice_profile (for quick-write voice options). */
export async function findProfileVoiceAndName(
  profileId: string,
): Promise<{ full_name: string | null; title: string | null; voice_profile: unknown } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("team_profiles")
    .select("full_name, title, voice_profile")
    .eq("id", profileId)
    .single();
  return data;
}

/** Active team profiles with voice_profile (for admin learning). */
export async function findActiveProfilesWithVoice(): Promise<TeamProfileRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_profiles")
    .select("id, full_name, voice_profile")
    .eq("status", "active");

  if (error) throw new Error(`team.findActiveProfilesWithVoice: ${error.message}`);
  return (data ?? []) as TeamProfileRow[];
}

// ─── Team members (V1 owner_id / team_members) ───────────────────────────────

export interface TeamMemberRow {
  id: string;
  email: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
  member_id: string | null;
}

export async function listTeamMembersByOwner(ownerId: string): Promise<TeamMemberRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("id, email, status, invited_at, accepted_at, member_id")
    .eq("owner_id", ownerId)
    .neq("status", "removed")
    .order("invited_at", { ascending: false });
  if (error) throw new Error(`team.listTeamMembersByOwner: ${error.message}`);
  return (data ?? []) as TeamMemberRow[];
}

export async function getUsersByIds(
  userIds: string[],
): Promise<Record<string, { name: string | null; avatar_url: string | null }>> {
  if (userIds.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("users").select("id, name, avatar_url").in("id", userIds);
  const map: Record<string, { name: string | null; avatar_url: string | null }> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; name: string | null; avatar_url: string | null };
    map[r.id] = { name: r.name, avatar_url: r.avatar_url };
  }
  return map;
}

export async function getOwnerTeamByUserId(userId: string): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("teams").select("id").eq("owner_id", userId).single();
  return data as { id: string } | null;
}

export async function getExistingInvite(
  ownerId: string,
  email: string,
): Promise<{ id: string; status: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("team_members")
    .select("id, status")
    .eq("owner_id", ownerId)
    .eq("email", email)
    .single();
  return data as { id: string; status: string } | null;
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("users").select("id").eq("email", email).single();
  return data ? (data as { id: string }).id : null;
}

export async function upsertTeamMember(
  existingId: string | null,
  payload: {
    owner_id: string;
    email: string;
    status: string;
    member_id: string | null;
    accepted_at: string | null;
  },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (existingId) {
    const { error } = await supabase.from("team_members").update(payload).eq("id", existingId);
    if (error) throw new Error(`team.upsertTeamMember: ${error.message}`);
  } else {
    const { error } = await supabase.from("team_members").insert(payload);
    if (error) throw new Error(`team.upsertTeamMember: ${error.message}`);
  }
}

export async function getTeamMemberById(id: string): Promise<{
  id: string;
  owner_id: string;
  email: string;
  member_id: string | null;
} | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("team_members")
    .select("id, owner_id, email, member_id")
    .eq("id", id)
    .single();
  return data as { id: string; owner_id: string; email: string; member_id: string | null } | null;
}

export async function deleteTeamMemberById(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw new Error(`team.deleteTeamMemberById: ${error.message}`);
}

/** Soft-remove team_profiles by team_id and user_id or email (for V2 sync). */
export async function setTeamProfilesRemovedByUserId(
  teamId: string,
  userId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("team_profiles")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .neq("role", "owner");
}

export async function setTeamProfilesRemovedByEmail(
  teamId: string,
  email: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("team_profiles")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("email", email)
    .neq("role", "owner");
}

// ─── Teams (V2) ─────────────────────────────────────────────────────────────

const TEAM_SELECT =
  "id, owner_id, name, description, industry, target_audience, shared_goal, created_at, updated_at";

export async function getTeamById(teamId: string): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .select(TEAM_SELECT)
    .eq("id", teamId)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

// ─── Team activity log ───────────────────────────────────────────────────────

export async function getTeamActivityCount(teamId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("team_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if (error) throw new Error(`team.getTeamActivityCount: ${error.message}`);
  return count ?? 0;
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

export async function listTeamActivity(
  teamId: string,
  limit: number,
  offset: number,
): Promise<TeamActivityRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_activity_log")
    .select("id, user_id, action, target_type, target_id, details, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`team.listTeamActivity: ${error.message}`);
  return (data ?? []) as TeamActivityRow[];
}

// ─── Teams CRUD (create, update) + team_profiles ─────────────────────────────

export async function createTeam(
  ownerId: string,
  payload: {
    name: string;
    description?: string | null;
    industry?: string | null;
    target_audience?: string | null;
    shared_goal?: string | null;
  },
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teams")
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
  return data as Record<string, unknown>;
}

export async function addOwnerProfile(
  teamId: string,
  userId: string,
  email: string | null,
  fullName: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("team_profiles").insert({
    team_id: teamId,
    user_id: userId,
    email,
    full_name: fullName,
    role: "owner",
    status: "active",
    is_default: true,
    accepted_at: new Date().toISOString(),
  });
  if (error) throw new Error(`team.addOwnerProfile: ${error.message}`);
}

export async function updateTeam(
  teamId: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .update(updates)
    .eq("id", teamId)
    .select(TEAM_SELECT)
    .single();
  if (error) throw new Error(`team.updateTeam: ${error.message}`);
  return data as Record<string, unknown>;
}

const PROFILE_SELECT =
  "id, team_id, user_id, email, full_name, title, linkedin_url, bio, expertise_areas, voice_profile, avatar_url, role, status, is_default, invited_at, accepted_at, created_at, updated_at";

export async function listProfilesByTeamId(teamId: string): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_profiles")
    .select(PROFILE_SELECT)
    .eq("team_id", teamId)
    .neq("status", "removed")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`team.listProfilesByTeamId: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function getProfileByIdWithTeam(
  profileId: string,
): Promise<{ id: string; team_id: string; user_id: string | null; teams?: { owner_id: string } } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("team_profiles")
    .select("id, team_id, user_id, teams(owner_id)")
    .eq("id", profileId)
    .single();
  return data as { id: string; team_id: string; user_id: string | null; teams?: { owner_id: string } } | null;
}

export async function getProfileByIdForDelete(
  profileId: string,
): Promise<{ id: string; role: string; team_id: string; teams?: { owner_id: string } } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("team_profiles")
    .select("id, role, team_id, teams(owner_id)")
    .eq("id", profileId)
    .single();
  return data as { id: string; role: string; team_id: string; teams?: { owner_id: string } } | null;
}

export async function createTeamProfile(
  teamId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_profiles")
    .insert({ team_id: teamId, ...payload })
    .select(PROFILE_SELECT)
    .single();
  if (error) throw new Error(`team.createTeamProfile: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function updateTeamProfile(
  profileId: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_profiles")
    .update(updates)
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw new Error(`team.updateTeamProfile: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function setTeamProfileRemoved(profileId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("team_profiles")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw new Error(`team.setTeamProfileRemoved: ${error.message}`);
}

export async function findProfileByTeamAndEmail(
  teamId: string,
  email: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("team_profiles")
    .select("id")
    .eq("team_id", teamId)
    .eq("email", email)
    .single();
  return data as { id: string } | null;
}

export async function getUserIdByEmailForProfile(email: string): Promise<string | null> {
  return getUserIdByEmail(email);
}
