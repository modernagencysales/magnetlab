/** Accelerator Enrollment Service.
 *  Creates enrollments from Stripe payments, checks access.
 *  Separate from accelerator-program.ts to keep billing logic isolated.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { ProgramEnrollment, ModuleId, ModuleStatus } from '@/lib/types/accelerator';
import { MODULE_IDS, ENROLLMENT_COLUMNS } from '@/lib/types/accelerator';
import { initializeSystemSchedules } from './accelerator-scheduler';

const LOG_CTX = 'accelerator-enrollment';

// ─── Constants ──────────────────────────────────────────

/** All modules included in the accelerator purchase. */
const ALL_MODULES: ModuleId[] = [...MODULE_IDS];

/** Stripe product ID for the accelerator. Set via env var. */
export const ACCELERATOR_STRIPE_PRODUCT_ID = process.env.ACCELERATOR_STRIPE_PRODUCT_ID || '';

/** Stripe price ID for the accelerator. Set via env var. */
export const ACCELERATOR_STRIPE_PRICE_ID = process.env.ACCELERATOR_STRIPE_PRICE_ID || '';

// ─── Access Check ───────────────────────────────────────

/** Check if a user has an active accelerator enrollment. */
export async function hasAcceleratorAccess(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_enrollments')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false; // not found
    logError(LOG_CTX, error, { userId });
    return false;
  }

  return !!data;
}

// ─── Read ───────────────────────────────────────────────

/** Look up an enrollment by its Stripe payment intent ID (stored in intake_data). */
export async function getEnrollmentByPaymentId(
  paymentIntentId: string
): Promise<ProgramEnrollment | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_enrollments')
    .select(ENROLLMENT_COLUMNS)
    .eq('stripe_subscription_id', paymentIntentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logError(LOG_CTX, error, { paymentIntentId });
    return null;
  }

  return data;
}

// ─── Create ─────────────────────────────────────────────

/** Create a paid enrollment with all modules unlocked. */
export async function createPaidEnrollment(
  userId: string,
  stripeCustomerId: string,
  paymentIntentId: string
): Promise<ProgramEnrollment | null> {
  const supabase = getSupabaseAdminClient();

  const { data: enrollment, error: enrollError } = await supabase
    .from('program_enrollments')
    .insert({
      user_id: userId,
      selected_modules: ALL_MODULES,
      coaching_mode: 'guide_me',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: paymentIntentId, // reusing field for payment intent ID
      status: 'active',
    })
    .select(ENROLLMENT_COLUMNS)
    .single();

  if (enrollError || !enrollment) {
    logError(LOG_CTX, enrollError, { userId, stripeCustomerId });
    return null;
  }

  // Create module rows for all modules
  const moduleRows = ALL_MODULES.map((moduleId) => ({
    enrollment_id: enrollment.id,
    module_id: moduleId,
    status: 'not_started' as ModuleStatus,
  }));

  const { error: modError } = await supabase.from('program_modules').insert(moduleRows);

  if (modError) {
    logError(LOG_CTX, modError, { enrollmentId: enrollment.id });
    // Non-fatal: enrollment exists, modules can be created later
  }

  // Initialize system schedules — non-fatal, enrollment succeeds regardless
  try {
    await initializeSystemSchedules(enrollment.id);
  } catch (err) {
    logError(LOG_CTX, err, { enrollmentId: enrollment.id, step: 'schedule_init' });
  }

  return enrollment;
}
