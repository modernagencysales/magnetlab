/** Enrollment & Usage Actions.
 *  Actions for agents to check enrollment status and usage allocation.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { checkUsageAllocation } from '@/lib/services/accelerator-usage';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'get_enrollment_status',
  description:
    'Check if the user is enrolled in the GTM Accelerator. Returns enrollment status, selected modules, and coaching mode.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const hasAccess = await hasAcceleratorAccess(ctx.userId);
    if (!hasAccess) {
      return {
        success: true,
        data: {
          enrolled: false,
          message: 'Not enrolled in the GTM Accelerator. Purchase at /api/accelerator/enroll.',
        },
        displayHint: 'enrollment_card',
      };
    }

    const enrollment = await getEnrollmentByUserId(ctx.userId);
    return {
      success: true,
      data: {
        enrolled: true,
        status: enrollment?.status || 'active',
        selected_modules: enrollment?.selected_modules || [],
        coaching_mode: enrollment?.coaching_mode || 'guide_me',
        onboarding_completed: !!enrollment?.onboarding_completed_at,
      },
      displayHint: 'enrollment_card',
    };
  },
});

registerAction({
  name: 'check_usage',
  description:
    "Check the user's current usage against their monthly allocation. Shows sessions, deliverables, and API calls used.",
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) {
      return { success: false, error: 'No active enrollment found.' };
    }

    const usage = await checkUsageAllocation(enrollment.id);
    return {
      success: true,
      data: usage,
      displayHint: 'metrics_card',
    };
  },
});
