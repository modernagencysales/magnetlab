/**
 * Content Pipeline Planner Service
 * Week plans CRUD, generate (AI), approve.
 */

import { generateWeekPlan } from '@/lib/ai/content-pipeline/week-planner';
import { logError } from '@/lib/utils/logger';
import * as cpPlannerRepo from '@/server/repositories/cp-planner.repo';

export async function list(userId: string, limit = 12) {
  const { data, error } = await cpPlannerRepo.listWeekPlans(userId, limit);
  if (error) {
    logError('cp/planner', error, { step: 'planner_list_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, plans: data };
}

export async function create(
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
  const { data, error } = await cpPlannerRepo.createWeekPlan(userId, payload);
  if (error) {
    if (error.code === '23505') return { success: false, error: 'conflict' as const, message: 'A plan already exists for this week' };
    logError('cp/planner', error, { step: 'planner_create_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, plan: data };
}

export async function getById(userId: string, id: string) {
  const { data, error } = await cpPlannerRepo.getWeekPlanById(id, userId);
  if (error || !data) return { success: false, error: 'not_found' as const };
  return { success: true, plan: data };
}

const ALLOWED_UPDATE_FIELDS = [
  'posts_per_week',
  'pillar_moments_pct',
  'pillar_teaching_pct',
  'pillar_human_pct',
  'pillar_collab_pct',
  'planned_posts',
  'status',
  'generation_notes',
];

export async function update(userId: string, id: string, body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) return { success: false, error: 'validation' as const, message: 'No valid fields to update' };

  const { data, error } = await cpPlannerRepo.updateWeekPlan(id, userId, updates);
  if (error) {
    logError('cp/planner', error, { step: 'planner_update_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, plan: data };
}

export async function deletePlan(userId: string, id: string) {
  const { error } = await cpPlannerRepo.deleteWeekPlan(id, userId);
  if (error) {
    logError('cp/planner', error, { step: 'planner_delete_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function generate(
  userId: string,
  payload: {
    week_start_date: string;
    posts_per_week?: number;
    pillar_distribution?: Record<string, number>;
  }
) {
  const ideas = await cpPlannerRepo.getIdeasForPlanner(userId);
  const templates = await cpPlannerRepo.getActiveTemplates(userId);
  const slots = await cpPlannerRepo.getActiveSlots(userId);
  const businessContext = await cpPlannerRepo.getBusinessContext(userId);
  const recentPostTitles = await cpPlannerRepo.getRecentPostDraftContent(userId, 20);

  if (ideas.length === 0) {
    return { success: false, error: 'validation' as const, message: 'No ideas available. Process some transcripts first.' };
  }

  const dist = payload.pillar_distribution || {
    moments_that_matter: 25,
    teaching_promotion: 35,
    human_personal: 20,
    collaboration_social_proof: 20,
  };

  const result = await generateWeekPlan({
    userId,
    weekStartDate: payload.week_start_date,
    postsPerWeek: payload.posts_per_week || 5,
    pillarDistribution: dist,
    ideas,
    templates,
    slots,
    businessContext,
    recentPostTitles,
  });

  const { data: plan, error } = await cpPlannerRepo.upsertWeekPlan(userId, {
    week_start_date: payload.week_start_date,
    posts_per_week: payload.posts_per_week ?? 5,
    pillar_moments_pct: dist.moments_that_matter,
    pillar_teaching_pct: dist.teaching_promotion,
    pillar_human_pct: dist.human_personal,
    pillar_collab_pct: dist.collaboration_social_proof,
    planned_posts: result.plannedPosts,
    generation_notes: result.generationNotes,
    status: 'draft',
  });

  if (error) {
    logError('cp/planner', error, { step: 'planner_generate_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, plan, notes: result.generationNotes };
}

export async function approve(userId: string, planId: string) {
  const { data: plan, error: planError } = await cpPlannerRepo.getWeekPlanForApprove(planId, userId);
  if (planError || !plan) return { success: false, error: 'not_found' as const, message: 'Plan not found' };
  if (plan.status !== 'draft') return { success: false, error: 'validation' as const, message: 'Plan is not in draft status' };

  const plannedPosts = (plan.planned_posts as Array<{ idea_id: string; template_id: string | null; day: number; time: string; pillar: string }>) ?? [];
  const updatedPlannedPosts: Array<{ idea_id: string; template_id: string | null; day: number; time: string; pillar: string; assigned_post_id: string | null }> = [];

  for (const pp of plannedPosts) {
    const { data: created, error: insertError } = await cpPlannerRepo.insertPipelinePost({
      user_id: userId,
      idea_id: pp.idea_id,
      template_id: pp.template_id ?? null,
      status: 'draft',
      scheduled_time: null,
    });
    if (insertError) {
      logError('cp/planner', insertError, { step: 'planner_approve_insert' });
      return { success: false, error: 'database' as const, message: insertError.message };
    }
    updatedPlannedPosts.push({ ...pp, assigned_post_id: created?.id ?? null });
  }

  if (updatedPlannedPosts.length === 0) {
    return { success: false, error: 'validation' as const, message: 'No posts to approve' };
  }

  const { error: updateError } = await cpPlannerRepo.setWeekPlanApproved(planId, userId, {
    planned_posts: updatedPlannedPosts,
  });
  if (updateError) {
    logError('cp/planner', updateError, { step: 'planner_approve_update' });
    return { success: false, error: 'database' as const };
  }

  await cpPlannerRepo.setIdeasStatusWriting(
    plannedPosts.map((p) => p.idea_id),
    userId
  );

  return { success: true, posts_created: updatedPlannedPosts.length };
}
