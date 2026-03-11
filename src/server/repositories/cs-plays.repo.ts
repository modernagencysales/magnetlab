/**
 * Creative Strategy Plays Repository
 * ALL Supabase queries for cs_plays, cs_play_signals, cs_play_results,
 * cs_play_templates, cs_play_feedback, cs_play_assignments.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type {
  CsPlay,
  CsPlayResult,
  CsPlayTemplate,
  CsPlayFeedback,
  CsPlayAssignment,
  PlayFilters,
} from '@/lib/types/creative-strategy';

// ─── Column sets ────────────────────────────────────────────────────────────

const PLAY_COLUMNS =
  'id, title, thesis, exploit_type, format_instructions, status, visibility, niches, last_used_at, created_by, created_at, updated_at';

const RESULT_COLUMNS =
  'id, play_id, post_id, account_id, is_anonymous, baseline_impressions, actual_impressions, multiplier, likes, comments, niche, tested_at';

const TEMPLATE_COLUMNS =
  'id, play_id, name, structure, media_instructions, example_output, created_at';

const FEEDBACK_COLUMNS = 'id, play_id, user_id, rating, note, created_at';

const ASSIGNMENT_COLUMNS = 'id, play_id, user_id, assigned_by, status, assigned_at, updated_at';

// ─── Play reads ─────────────────────────────────────────────────────────────

export async function findPlays(filters: PlayFilters): Promise<{ data: CsPlay[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = supabase
    .from('cs_plays')
    .select(PLAY_COLUMNS, { count: 'exact' })
    .order('updated_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.visibility) query = query.eq('visibility', filters.visibility);
  if (filters.exploit_type) query = query.eq('exploit_type', filters.exploit_type);
  if (filters.niche) query = query.contains('niches', [filters.niche]);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`cs-plays.findPlays: ${error.message}`);
  return { data: (data ?? []) as CsPlay[], count: count ?? 0 };
}

export async function findPlayById(id: string): Promise<CsPlay | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_plays')
    .select(PLAY_COLUMNS)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as CsPlay;
}

// ─── Play writes ────────────────────────────────────────────────────────────

export async function createPlay(
  insert: Omit<CsPlay, 'id' | 'created_at' | 'updated_at' | 'last_used_at'>
): Promise<CsPlay> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_plays')
    .insert(insert)
    .select(PLAY_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createPlay: ${error.message}`);
  return data as CsPlay;
}

const ALLOWED_PLAY_UPDATE_FIELDS: string[] = [
  'title',
  'thesis',
  'exploit_type',
  'format_instructions',
  'status',
  'visibility',
  'niches',
  'last_used_at',
];

export async function updatePlay(id: string, body: Record<string, unknown>): Promise<CsPlay> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_PLAY_UPDATE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_plays')
    .update(updates)
    .eq('id', id)
    .select(PLAY_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.updatePlay: ${error.message}`);
  return data as CsPlay;
}

export async function deletePlay(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cs_plays').delete().eq('id', id);
  if (error) throw new Error(`cs-plays.deletePlay: ${error.message}`);
}

// ─── Play signals (junction) ────────────────────────────────────────────────

export async function linkSignalsToPlay(playId: string, signalIds: string[]): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const rows = signalIds.map((signalId) => ({ play_id: playId, signal_id: signalId }));
  const { error } = await supabase.from('cs_play_signals').insert(rows);
  if (error) throw new Error(`cs-plays.linkSignalsToPlay: ${error.message}`);
}

export async function findSignalsByPlayId(playId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_signals')
    .select('signal_id')
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.findSignalsByPlayId: ${error.message}`);
  return (data ?? []).map((r) => r.signal_id);
}

export async function countSignalsByPlayId(playId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('cs_play_signals')
    .select('play_id', { count: 'exact', head: true })
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.countSignalsByPlayId: ${error.message}`);
  return count ?? 0;
}

// ─── Play results ───────────────────────────────────────────────────────────

export async function findResultsByPlayId(playId: string): Promise<CsPlayResult[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_results')
    .select(RESULT_COLUMNS)
    .eq('play_id', playId)
    .order('tested_at', { ascending: false });
  if (error) throw new Error(`cs-plays.findResultsByPlayId: ${error.message}`);
  return (data ?? []) as CsPlayResult[];
}

export async function createPlayResult(
  insert: Omit<CsPlayResult, 'id' | 'tested_at'>
): Promise<CsPlayResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_results')
    .insert(insert)
    .select(RESULT_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createPlayResult: ${error.message}`);
  return data as CsPlayResult;
}

// ─── Play templates ─────────────────────────────────────────────────────────

export async function findTemplatesByPlayId(playId: string): Promise<CsPlayTemplate[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.findTemplatesByPlayId: ${error.message}`);
  return (data ?? []) as CsPlayTemplate[];
}

export async function createTemplate(
  insert: Omit<CsPlayTemplate, 'id' | 'created_at'>
): Promise<CsPlayTemplate> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_templates')
    .insert(insert)
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createTemplate: ${error.message}`);
  return data as CsPlayTemplate;
}

const ALLOWED_TEMPLATE_UPDATE_FIELDS: string[] = [
  'name',
  'structure',
  'media_instructions',
  'example_output',
];

export async function updateTemplate(
  id: string,
  body: Record<string, unknown>
): Promise<CsPlayTemplate> {
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_TEMPLATE_UPDATE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('cs-plays.updateTemplate: no valid fields to update');
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_templates')
    .update(updates)
    .eq('id', id)
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.updateTemplate: ${error.message}`);
  return data as CsPlayTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cs_play_templates').delete().eq('id', id);
  if (error) throw new Error(`cs-plays.deleteTemplate: ${error.message}`);
}

// ─── Play feedback ──────────────────────────────────────────────────────────

export async function findFeedbackByPlayId(playId: string): Promise<CsPlayFeedback[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_feedback')
    .select(FEEDBACK_COLUMNS)
    .eq('play_id', playId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`cs-plays.findFeedbackByPlayId: ${error.message}`);
  return (data ?? []) as CsPlayFeedback[];
}

export async function upsertFeedback(
  playId: string,
  userId: string,
  rating: string,
  note: string | null
): Promise<CsPlayFeedback> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_feedback')
    .upsert({ play_id: playId, user_id: userId, rating, note }, { onConflict: 'play_id,user_id' })
    .select(FEEDBACK_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.upsertFeedback: ${error.message}`);
  return data as CsPlayFeedback;
}

export async function countFeedbackByPlayId(playId: string): Promise<{ up: number; down: number }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_feedback')
    .select('rating')
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.countFeedbackByPlayId: ${error.message}`);
  const ratings = data ?? [];
  return {
    up: ratings.filter((r) => r.rating === 'up').length,
    down: ratings.filter((r) => r.rating === 'down').length,
  };
}

// ─── Play assignments ───────────────────────────────────────────────────────

export async function findAssignmentsByUserId(userId: string): Promise<CsPlayAssignment[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_assignments')
    .select(ASSIGNMENT_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false });
  if (error) throw new Error(`cs-plays.findAssignmentsByUserId: ${error.message}`);
  return (data ?? []) as CsPlayAssignment[];
}

export async function createAssignment(
  insert: Omit<CsPlayAssignment, 'id' | 'assigned_at' | 'updated_at'>
): Promise<CsPlayAssignment> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_assignments')
    .insert(insert)
    .select(ASSIGNMENT_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createAssignment: ${error.message}`);
  return data as CsPlayAssignment;
}

// ─── Aggregation helpers ────────────────────────────────────────────────────

export async function countPostsByPlayId(playId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id', { count: 'exact', head: true })
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.countPostsByPlayId: ${error.message}`);
  return count ?? 0;
}
