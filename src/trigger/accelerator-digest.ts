/** Accelerator Weekly Digest.
 *  Generates a metrics digest email and creates a pending_review deliverable.
 *  Triggered weekly by the accelerator-scheduler. */

import { task, logger } from '@trigger.dev/sdk/v3';
import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getMetricsSummary } from '@/lib/services/accelerator-metrics';
import { createDeliverable } from '@/lib/services/accelerator-program';
import { sendEmail } from '@/lib/integrations/resend';

// ─── Types ────────────────────────────────────────────

interface DigestPayload {
  enrollmentId: string;
  config: Record<string, unknown>;
}

// ─── Columns ──────────────────────────────────────────

const ENROLLMENT_COLUMNS = 'id, user_id' as const;
const USER_COLUMNS = 'name, email' as const;

// ─── Task ─────────────────────────────────────────────

export const acceleratorDigest = task({
  id: 'accelerator-digest',
  maxDuration: 60,
  retry: { maxAttempts: 2 },
  run: async (payload: DigestPayload) => {
    const { enrollmentId } = payload;
    logger.info('Generating weekly digest', { enrollmentId });

    const supabase = getSupabaseAdminClient();

    // Get enrollment + user info
    const { data: enrollment } = await supabase
      .from('program_enrollments')
      .select(ENROLLMENT_COLUMNS)
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      logger.error('Enrollment not found', { enrollmentId });
      return { sent: false };
    }

    const { data: user } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', enrollment.user_id)
      .single();

    if (!user?.email) {
      logger.error('User email not found', { userId: enrollment.user_id });
      return { sent: false };
    }

    // Get metrics summary
    const summary = await getMetricsSummary(enrollmentId);

    // Build digest content
    const digestLines: string[] = [
      `Hi ${user.name || 'there'},`,
      '',
      'Here is your weekly GTM Accelerator metrics digest:',
      '',
    ];

    if (summary.totalMetrics === 0) {
      digestLines.push(
        'No metrics collected yet. Complete your first module to start tracking progress.'
      );
    } else {
      for (const mod of summary.modules) {
        digestLines.push(`**Module ${mod.module_id.toUpperCase()}**`);
        for (const m of mod.metrics) {
          const indicator = m.status === 'below' ? '⚠️' : m.status === 'above' ? '✅' : '➡️';
          digestLines.push(`  ${indicator} ${m.metric_key}: ${m.value}`);
        }
        digestLines.push('');
      }

      if (summary.belowCount > 0) {
        digestLines.push(
          `${summary.belowCount} metric(s) below benchmark. Open the accelerator to run diagnostics.`
        );
      } else {
        digestLines.push('All metrics are on track. Keep up the momentum!');
      }
    }

    const digestText = digestLines.join('\n');

    // Wrap plain text in HTML for Resend
    const digestHtml = digestText
      .split('\n')
      .map((line) => (line.trim() === '' ? '<br/>' : `<p>${line}</p>`))
      .join('\n');

    // Send email
    await sendEmail({
      to: user.email,
      subject: `Your Weekly GTM Digest — ${summary.belowCount > 0 ? `${summary.belowCount} items need attention` : 'All on track'}`,
      html: digestHtml,
    });

    // Create deliverable for tracking
    await createDeliverable({
      enrollment_id: enrollmentId,
      module_id: 'm6' as const,
      deliverable_type: 'metrics_digest',
      status: 'approved',
    });

    logger.info('Weekly digest sent', {
      enrollmentId,
      email: user.email,
      metricsCount: summary.totalMetrics,
    });

    return { sent: true, metricsCount: summary.totalMetrics };
  },
});
