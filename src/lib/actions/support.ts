/** Support Ticket Actions.
 *  Allows agents to escalate issues to human support.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { logError } from '@/lib/utils/logger';

const LOG_CTX = 'action/support';

registerAction({
  name: 'create_support_ticket',
  description:
    'Escalate an issue to the human support team. Use when the agent cannot resolve a problem after diagnosis.',
  parameters: {
    properties: {
      module_id: { type: 'string', description: 'Optional module ID related to the issue' },
      summary: { type: 'string', description: 'Agent-generated summary of the issue' },
      context: {
        type: 'object',
        description: 'What was tried, what failed, relevant diagnostic results',
      },
    },
    required: ['summary', 'context'],
  },
  handler: async (
    ctx,
    params: { module_id?: string; summary: string; context: Record<string, unknown> }
  ) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('program_support_tickets')
      .insert({
        enrollment_id: enrollment.id,
        module_id: params.module_id || null,
        summary: params.summary,
        context: params.context,
        status: 'open',
      })
      .select('id, summary, status, created_at')
      .single();

    if (error) {
      logError(LOG_CTX, error, { enrollmentId: enrollment.id });
      return { success: false, error: 'Failed to create support ticket.' };
    }

    return { success: true, data, displayHint: 'text' };
  },
});
