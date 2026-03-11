/** Accelerator Program State Service.
 *  CRUD for enrollments, modules, deliverables.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type {
  ProgramEnrollment,
  ProgramModule,
  ProgramDeliverable,
  ProgramState,
  ModuleId,
  ModuleStatus,
  DeliverableType,
  DeliverableStatus,
  CoachingMode,
  IntakeData,
  ProgramSop,
} from '@/lib/types/accelerator';
import {
  ENROLLMENT_COLUMNS,
  MODULE_COLUMNS,
  DELIVERABLE_COLUMNS,
  SOP_COLUMNS,
} from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-program';

// ─── Enrollment ──────────────────────────────────────────

export async function getEnrollmentByUserId(userId: string): Promise<ProgramEnrollment | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_enrollments')
    .select(ENROLLMENT_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    logError(LOG_CTX, error, { userId });
    return null;
  }
  return data;
}

export async function createEnrollment(
  userId: string,
  selectedModules: ModuleId[],
  coachingMode: CoachingMode = 'guide_me'
): Promise<ProgramEnrollment | null> {
  const supabase = getSupabaseAdminClient();

  // Create enrollment
  const { data: enrollment, error: enrollError } = await supabase
    .from('program_enrollments')
    .insert({
      user_id: userId,
      selected_modules: selectedModules,
      coaching_mode: coachingMode,
    })
    .select(ENROLLMENT_COLUMNS)
    .single();

  if (enrollError || !enrollment) {
    logError(LOG_CTX, enrollError, { userId });
    return null;
  }

  // Create module rows for selected modules
  const moduleRows = selectedModules.map((moduleId) => ({
    enrollment_id: enrollment.id,
    module_id: moduleId,
    status: 'not_started' as ModuleStatus,
  }));

  const { error: modError } = await supabase.from('program_modules').insert(moduleRows);

  if (modError) {
    logError(LOG_CTX, modError, { enrollmentId: enrollment.id });
  }

  return enrollment;
}

export async function updateEnrollmentIntake(
  enrollmentId: string,
  intakeData: IntakeData
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('program_enrollments')
    .update({ intake_data: intakeData, onboarding_completed_at: new Date().toISOString() })
    .eq('id', enrollmentId);

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return false;
  }
  return true;
}

// ─── Modules ─────────────────────────────────────────────

export async function getModulesByEnrollment(enrollmentId: string): Promise<ProgramModule[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_modules')
    .select(MODULE_COLUMNS)
    .eq('enrollment_id', enrollmentId)
    .order('module_id');

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return [];
  }
  return data || [];
}

export async function updateModuleStatus(
  moduleId: string,
  status: ModuleStatus,
  currentStep?: string
): Promise<ProgramModule | null> {
  const supabase = getSupabaseAdminClient();
  const updates: Record<string, unknown> = { status };

  if (currentStep !== undefined) updates.current_step = currentStep;
  if (status === 'active') updates.started_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('program_modules')
    .update(updates)
    .eq('id', moduleId)
    .select(MODULE_COLUMNS)
    .single();

  if (error) {
    logError(LOG_CTX, error, { moduleId, status });
    return null;
  }
  return data;
}

// ─── Deliverables ────────────────────────────────────────

export async function getDeliverablesByEnrollment(
  enrollmentId: string
): Promise<ProgramDeliverable[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_deliverables')
    .select(DELIVERABLE_COLUMNS)
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false });

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return [];
  }
  return data || [];
}

export async function getReviewQueue(enrollmentId: string): Promise<ProgramDeliverable[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_deliverables')
    .select(DELIVERABLE_COLUMNS)
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return [];
  }
  return data || [];
}

export interface CreateDeliverableInput {
  enrollment_id: string;
  module_id: ModuleId;
  deliverable_type: DeliverableType;
  entity_id?: string;
  entity_type?: string;
  status?: DeliverableStatus;
}

export async function createDeliverable(
  input: CreateDeliverableInput
): Promise<ProgramDeliverable | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_deliverables')
    .insert({
      enrollment_id: input.enrollment_id,
      module_id: input.module_id,
      deliverable_type: input.deliverable_type,
      entity_id: input.entity_id || null,
      entity_type: input.entity_type || null,
      status: input.status || 'in_progress',
    })
    .select(DELIVERABLE_COLUMNS)
    .single();

  if (error) {
    logError(LOG_CTX, error, { input });
    return null;
  }
  return data;
}

export async function updateDeliverableStatus(
  deliverableId: string,
  status: DeliverableStatus,
  validationResult?: {
    passed: boolean;
    checks: Array<{ check: string; passed: boolean; severity: string; feedback?: string }>;
    feedback: string;
  }
): Promise<ProgramDeliverable | null> {
  const supabase = getSupabaseAdminClient();
  const updates: Record<string, unknown> = { status };

  if (validationResult) {
    updates.validation_result = validationResult;
    updates.validated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('program_deliverables')
    .update(updates)
    .eq('id', deliverableId)
    .select(DELIVERABLE_COLUMNS)
    .single();

  if (error) {
    logError(LOG_CTX, error, { deliverableId, status });
    return null;
  }
  return data;
}

// ─── Composite State ─────────────────────────────────────

export async function getProgramState(userId: string): Promise<ProgramState | null> {
  const enrollment = await getEnrollmentByUserId(userId);
  if (!enrollment) return null;

  const [modules, deliverables, reviewQueue, usageThisPeriod] = await Promise.all([
    getModulesByEnrollment(enrollment.id),
    getDeliverablesByEnrollment(enrollment.id),
    getReviewQueue(enrollment.id),
    getUsageThisPeriod(enrollment.id),
  ]);

  return { enrollment, modules, deliverables, reviewQueue, usageThisPeriod };
}

async function getUsageThisPeriod(
  enrollmentId: string
): Promise<{ sessions: number; deliverables: number; api_calls: number }> {
  const supabase = getSupabaseAdminClient();
  const periodStart = new Date();
  periodStart.setDate(1); // First of current month
  periodStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('program_usage_events')
    .select('event_type')
    .eq('enrollment_id', enrollmentId)
    .gte('created_at', periodStart.toISOString());

  if (error || !data) return { sessions: 0, deliverables: 0, api_calls: 0 };

  return {
    sessions: data.filter((e: { event_type: string }) => e.event_type === 'session_start').length,
    deliverables: data.filter((e: { event_type: string }) => e.event_type === 'deliverable_created')
      .length,
    api_calls: data.filter((e: { event_type: string }) => e.event_type === 'api_call').length,
  };
}

// ─── SOPs ────────────────────────────────────────────────

export async function getSopsByModule(moduleId: ModuleId): Promise<ProgramSop[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_sops')
    .select(SOP_COLUMNS)
    .eq('module_id', moduleId)
    .order('sop_number');

  if (error) {
    logError(LOG_CTX, error, { moduleId });
    return [];
  }
  return data || [];
}
