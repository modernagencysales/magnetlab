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
import { checkUsageAllocation } from './accelerator-usage';

const LOG_CTX = 'accelerator-program';

// ─── Update Field Whitelists ──────────────────────────────

const ALLOWED_MODULE_UPDATE_FIELDS = new Set([
  'status',
  'current_step',
  'started_at',
  'completed_at',
]);

const ALLOWED_DELIVERABLE_UPDATE_FIELDS = new Set(['status', 'validation_result', 'validated_at']);

const ALLOWED_ENROLLMENT_UPDATE_FIELDS = new Set(['intake_data', 'onboarding_completed_at']);

/** Pick only allowed fields from an object. */
function pickAllowed(obj: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (allowed.has(key)) result[key] = obj[key];
  }
  return result;
}

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
  const updates = pickAllowed(
    { intake_data: intakeData, onboarding_completed_at: new Date().toISOString() },
    ALLOWED_ENROLLMENT_UPDATE_FIELDS
  );
  const { error } = await supabase
    .from('program_enrollments')
    .update(updates)
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
  const raw: Record<string, unknown> = { status };
  if (currentStep !== undefined) raw.current_step = currentStep;
  if (status === 'active') raw.started_at = new Date().toISOString();
  if (status === 'completed') raw.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('program_modules')
    .update(pickAllowed(raw, ALLOWED_MODULE_UPDATE_FIELDS))
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
  const raw: Record<string, unknown> = { status };
  if (validationResult) {
    raw.validation_result = validationResult;
    raw.validated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('program_deliverables')
    .update(pickAllowed(raw, ALLOWED_DELIVERABLE_UPDATE_FIELDS))
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

  const [modules, deliverables, reviewQueue, { usage: usageThisPeriod }] = await Promise.all([
    getModulesByEnrollment(enrollment.id),
    getDeliverablesByEnrollment(enrollment.id),
    getReviewQueue(enrollment.id),
    checkUsageAllocation(enrollment.id),
  ]);

  return { enrollment, modules, deliverables, reviewQueue, usageThisPeriod };
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
