/**
 * Content Pipeline Planner Repository
 * All Supabase access for cp_week_plans and related (cp_content_ideas, cp_post_templates, cp_posting_slots, cp_business_context, cp_pipeline_posts).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const PLAN_COLUMNS =
  'id, user_id, week_start_date, posts_per_week, pillar_moments_pct, pillar_teaching_pct, pillar_human_pct, pillar_collab_pct, planned_posts, status, created_at, updated_at';

export async function listWeekPlans(userId: string, limit: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_week_plans')
    .select(PLAN_COLUMNS)
    .eq('user_id', userId)
    .order('week_start_date', { ascending: false })
    .limit(limit);
  return { data: data ?? [], error };
}

export async function createWeekPlan(
  userId: string,
  payload: {
    week_start_date: string;
    posts_per_week?: number;
    pillar_moments_pct?: number;
    pillar_teaching_pct?: number;
    pillar_human_pct?: number;
    pillar_collab_pct?: number;
    planned_posts?: unknown[];
    generation_notes?: string | null;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_week_plans')
    .insert({
      user_id: userId,
      week_start_date: payload.week_start_date,
      posts_per_week: payload.posts_per_week ?? 5,
      pillar_moments_pct: payload.pillar_moments_pct ?? 25,
      pillar_teaching_pct: payload.pillar_teaching_pct ?? 25,
      pillar_human_pct: payload.pillar_human_pct ?? 25,
      pillar_collab_pct: payload.pillar_collab_pct ?? 25,
      planned_posts: payload.planned_posts ?? [],
      generation_notes: payload.generation_notes ?? null,
    })
    .select()
    .single();
  return { data, error };
}

export async function getWeekPlanById(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_week_plans')
    .select(PLAN_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function updateWeekPlan(
  id: string,
  userId: string,
  updates: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_week_plans')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

export async function deleteWeekPlan(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cp_week_plans').delete().eq('id', id).eq('user_id', userId);
  return { error };
}

export async function upsertWeekPlan(
  userId: string,
  payload: {
    week_start_date: string;
    posts_per_week?: number;
    pillar_moments_pct?: number;
    pillar_teaching_pct?: number;
    pillar_human_pct?: number;
    pillar_collab_pct?: number;
    planned_posts?: unknown[];
    generation_notes?: string | null;
    status?: string;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_week_plans')
    .upsert(
      {
        user_id: userId,
        week_start_date: payload.week_start_date,
        posts_per_week: payload.posts_per_week ?? 5,
        pillar_moments_pct: payload.pillar_moments_pct ?? 25,
        pillar_teaching_pct: payload.pillar_teaching_pct ?? 25,
        pillar_human_pct: payload.pillar_human_pct ?? 25,
        pillar_collab_pct: payload.pillar_collab_pct ?? 25,
        planned_posts: payload.planned_posts ?? [],
        generation_notes: payload.generation_notes ?? null,
        status: payload.status ?? 'draft',
      },
      { onConflict: 'user_id,week_start_date' }
    )
    .select()
    .single();
  return { data, error };
}

// For generate: fetch ideas, templates, slots, business context, recent posts
export async function getIdeasForPlanner(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_content_ideas')
    .select(
      'id, user_id, transcript_id, title, core_insight, why_post_worthy, full_context, content_type, content_pillar, relevance_score, status, post_ready, hook, key_points, target_audience, source_quote, composite_score, last_surfaced_at, similarity_hash, created_at, updated_at'
    )
    .eq('user_id', userId)
    .in('status', ['extracted', 'selected'])
    .order('composite_score', { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getActiveTemplates(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_post_templates')
    .select(
      'id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, created_at, updated_at'
    )
    .eq('user_id', userId)
    .eq('is_active', true);
  return data ?? [];
}

export async function getActiveSlots(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_posting_slots')
    .select('id, user_id, slot_number, time_of_day, day_of_week, timezone, is_active, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_active', true);
  return data ?? [];
}

export async function getBusinessContext(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_business_context')
    .select(
      'id, user_id, company_name, industry, company_description, icp_title, icp_industry, icp_pain_points, target_audience, content_preferences, created_at, updated_at'
    )
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function getRecentPostDraftContent(userId: string, limit: number) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_pipeline_posts')
    .select('draft_content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((p) => (p as { draft_content?: string }).draft_content?.substring(0, 100) || '').filter(Boolean);
}

// For approve: get plan, create pipeline posts, update plan, update idea statuses
export async function getWeekPlanForApprove(planId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_week_plans')
    .select(
      'id, user_id, week_start_date, posts_per_week, pillar_moments_pct, pillar_teaching_pct, pillar_human_pct, pillar_collab_pct, planned_posts, status, created_at, updated_at'
    )
    .eq('id', planId)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function insertPipelinePost(params: {
  user_id: string;
  idea_id: string;
  template_id: string | null;
  status: string;
  scheduled_time: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .insert(params)
    .select('id')
    .single();
  return { data, error };
}

export async function setWeekPlanApproved(
  planId: string,
  userId: string,
  payload: { planned_posts: unknown[] }
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_week_plans')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: userId,
      planned_posts: payload.planned_posts,
    })
    .eq('id', planId)
    .eq('user_id', userId);
  return { error };
}

export async function setIdeasStatusWriting(ideaIds: string[], userId: string) {
  if (ideaIds.length === 0) return { error: null };
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_content_ideas')
    .update({ status: 'writing' })
    .in('id', ideaIds)
    .eq('user_id', userId);
  return { error };
}
