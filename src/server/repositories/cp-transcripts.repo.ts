/**
 * Content Pipeline Transcripts Repository
 * All Supabase access for cp_call_transcripts, cp_knowledge_entries, cp_content_ideas, team_profiles, teams.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const LIST_COLUMNS =
  'id, source, title, call_date, duration_minutes, transcript_type, ideas_extracted_at, knowledge_extracted_at, team_id, speaker_profile_id, speaker_map, created_at';

export async function insertTranscript(params: {
  user_id: string;
  source: string;
  title: string;
  raw_transcript: string;
  team_id?: string | null;
  speaker_profile_id?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_call_transcripts')
    .insert({
      user_id: params.user_id,
      source: params.source,
      title: params.title,
      raw_transcript: params.raw_transcript,
      team_id: params.team_id ?? null,
      speaker_profile_id: params.speaker_profile_id ?? null,
    })
    .select()
    .single();
  return { data, error };
}

/** Find transcript by external_id + user_id (for webhook dedupe). */
export async function findTranscriptByExternalIdAndUser(externalId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_call_transcripts')
    .select('id')
    .eq('external_id', externalId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/** Insert transcript from external webhook (external_id, optional call_date, participants). */
export async function insertTranscriptFromWebhook(params: {
  user_id: string;
  source: string;
  external_id: string;
  title?: string | null;
  call_date?: string | null;
  duration_minutes?: number | null;
  participants?: string[] | null;
  raw_transcript: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_call_transcripts')
    .insert({
      user_id: params.user_id,
      source: params.source,
      external_id: params.external_id,
      title: params.title ?? null,
      call_date: params.call_date ?? null,
      duration_minutes: params.duration_minutes ?? null,
      participants: params.participants ?? null,
      raw_transcript: params.raw_transcript,
    })
    .select()
    .single();
  return { data, error };
}

export async function deleteTranscript(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_call_transcripts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
}

export async function listTranscripts(
  userId: string,
  teamId: string | null,
  speakerProfileId: string | null,
  limit: number
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_call_transcripts')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (teamId) {
    query = query.eq('team_id', teamId);
  } else {
    query = query.eq('user_id', userId);
  }
  if (speakerProfileId) {
    query = query.eq('speaker_profile_id', speakerProfileId);
  }

  const { data, error } = await query;
  return { data: data ?? [], error };
}

export async function getProfileNames(profileIds: string[]): Promise<Record<string, string>> {
  if (profileIds.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('id, full_name')
    .in('id', profileIds);
  if (!data) return {};
  return Object.fromEntries(data.map((p) => [p.id, p.full_name]));
}

export async function getTranscriptById(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_call_transcripts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function getKnowledgeCount(transcriptId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('cp_knowledge_entries')
    .select('id', { count: 'exact', head: true })
    .eq('transcript_id', transcriptId);
  return count ?? 0;
}

export async function getIdeasCount(transcriptId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('cp_content_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('transcript_id', transcriptId);
  return count ?? 0;
}

export async function getSpeakerName(profileId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('full_name')
    .eq('id', profileId)
    .single();
  return data?.full_name ?? null;
}

export async function updateTranscript(
  id: string,
  userId: string,
  updates: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_call_transcripts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

// For reprocess
export async function getTranscriptForReprocess(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_call_transcripts')
    .select('id, user_id, knowledge_extracted_at, ideas_extracted_at, team_id, speaker_profile_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function getKnowledgeEntriesForTranscript(transcriptId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_knowledge_entries')
    .select('id, tags')
    .eq('transcript_id', transcriptId);
  return data ?? [];
}

export async function deleteKnowledgeByTranscriptId(transcriptId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_knowledge_entries')
    .delete()
    .eq('transcript_id', transcriptId);
  return { error };
}

export async function deleteIdeasByTranscriptId(transcriptId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_content_ideas')
    .delete()
    .eq('transcript_id', transcriptId);
  return { error };
}

export async function decrementTagCount(userId: string, tagName: string, count: number) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('cp_decrement_tag_count', {
    p_user_id: userId,
    p_tag_name: tagName,
    p_count: count,
  });
  return { error };
}

export async function resetExtractionTimestamps(transcriptId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_call_transcripts')
    .update({
      knowledge_extracted_at: null,
      ideas_extracted_at: null,
    })
    .eq('id', transcriptId);
  return { error };
}

export async function getTeamIdByOwnerId(ownerId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('teams').select('id').eq('owner_id', ownerId).single();
  return data?.id ?? null;
}

export async function getTeamIdBySpeakerProfileId(profileId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('team_profiles').select('team_id').eq('id', profileId).single();
  return data?.team_id ?? null;
}
