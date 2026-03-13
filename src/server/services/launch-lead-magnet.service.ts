/**
 * Launch Lead Magnet Service
 * Compound action: validate content -> create lead magnet -> create funnel -> publish funnel.
 * All-or-nothing with rollback on failure. Optionally creates an email sequence.
 * Never imports from Next.js HTTP layer.
 */

import { z } from 'zod';
import { ARCHETYPES } from '@/lib/schemas/archetypes';
import { validateContentForPublish } from '@/server/services/funnels.service';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';
import * as funnelsService from '@/server/services/funnels.service';
import * as emailSequenceService from '@/server/services/email-sequence.service';
import { logApiError } from '@/lib/api/errors';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LaunchInput {
  title: string;
  archetype: string;
  content: Record<string, unknown>;
  slug: string;
  funnel_theme?: string;
  email_sequence?: {
    emails: Array<{
      subject: string;
      body: string;
      delay_days: number;
    }>;
  };
}

export interface LaunchResult {
  lead_magnet_id: string;
  funnel_id: string;
  public_url: string | null;
  email_sequence_id: string | null;
}

// ─── Validation schema ──────────────────────────────────────────────────────

const emailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  delay_days: z.number().int().min(0),
});

const launchSchema = z.object({
  title: z.string().min(1).max(200),
  archetype: z.enum(ARCHETYPES as unknown as [string, ...string[]]),
  content: z.record(z.unknown()),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, {
      message: 'Slug must be lowercase alphanumeric with hyphens, starting with a letter or number',
    }),
  funnel_theme: z.enum(['dark', 'light', 'modern']).optional(),
  email_sequence: z
    .object({
      emails: z.array(emailSchema).min(1),
    })
    .optional(),
});

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Atomic launch: validate content -> create lead magnet -> create funnel -> publish funnel.
 * Rolls back on failure so no orphaned resources remain.
 */
export async function launchLeadMagnet(
  scope: DataScope,
  input: Record<string, unknown>
): Promise<LaunchResult> {
  // Step 1: Validate request shape
  const parsed = launchSchema.safeParse(input);
  if (!parsed.success) {
    const fieldList = parsed.error.issues
      .map((i) => (i.path.length > 0 ? i.path.join('.') : '(root)') + ': ' + i.message)
      .join('; ');
    throw Object.assign(new Error(`Validation failed: ${fieldList}`), {
      statusCode: 400,
      details: parsed.error.issues,
    });
  }

  const { title, archetype, content, slug, funnel_theme, email_sequence } = parsed.data;

  // Step 2: Validate content against archetype publish schema
  const contentValidation = validateContentForPublish(content, archetype);
  if (!contentValidation.valid) {
    throw Object.assign(new Error(contentValidation.message), {
      statusCode: 400,
      missing_fields: contentValidation.missing_fields,
      archetype_schema_hint: contentValidation.archetype_schema_hint,
    });
  }

  // Step 3: Create lead magnet (plan-limit and validation errors propagate directly)
  const leadMagnet = await leadMagnetsService.createLeadMagnet(scope, {
    title,
    archetype,
  });

  // Step 3b: Persist content on the newly created lead magnet
  try {
    await leadMagnetsService.updateLeadMagnetContent(scope, leadMagnet.id, content);
  } catch (err) {
    // Rollback: delete the lead magnet
    try {
      await leadMagnetsService.deleteLeadMagnet(scope, leadMagnet.id);
    } catch (cleanupErr) {
      logApiError('launch-lead-magnet/rollback-lm-after-content', cleanupErr, {
        leadMagnetId: leadMagnet.id,
      });
    }
    throw err;
  }

  // Step 4: Create funnel
  let funnel: { id: string };
  try {
    funnel = await funnelsService.createFunnel(scope, {
      leadMagnetId: leadMagnet.id,
      slug,
      theme: funnel_theme || 'dark',
    });
  } catch (err) {
    // Rollback: delete the lead magnet
    try {
      await leadMagnetsService.deleteLeadMagnet(scope, leadMagnet.id);
    } catch (cleanupErr) {
      logApiError('launch-lead-magnet/rollback-lm-after-funnel', cleanupErr, {
        leadMagnetId: leadMagnet.id,
      });
    }
    throw err;
  }

  // Step 5: Publish funnel
  let publicUrl: string | null = null;
  try {
    const publishResult = await funnelsService.publishFunnel(scope, funnel.id, true);
    publicUrl = publishResult.publicUrl;
  } catch (err) {
    // Rollback: delete funnel, then lead magnet
    try {
      await funnelsService.deleteFunnel(scope, funnel.id);
    } catch (cleanupErr) {
      logApiError('launch-lead-magnet/rollback-funnel-after-publish', cleanupErr, {
        funnelId: funnel.id,
      });
    }
    try {
      await leadMagnetsService.deleteLeadMagnet(scope, leadMagnet.id);
    } catch (cleanupErr) {
      logApiError('launch-lead-magnet/rollback-lm-after-publish', cleanupErr, {
        leadMagnetId: leadMagnet.id,
      });
    }
    throw err;
  }

  // Step 6 (optional): Create + activate email sequence
  let emailSequenceId: string | null = null;
  if (email_sequence) {
    try {
      const emails = email_sequence.emails.map((e) => ({
        day: e.delay_days,
        subject: e.subject,
        body: e.body,
        replyTrigger: '',
      }));

      const genResult = await emailSequenceService.generate(leadMagnet.id, false, scope.userId);
      if (genResult.success && genResult.emailSequence) {
        // Overwrite with the user-provided emails
        const updateResult = await emailSequenceService.update(scope, leadMagnet.id, { emails });
        if (updateResult.success && updateResult.emailSequence) {
          emailSequenceId = updateResult.emailSequence.id;
          // Activate
          await emailSequenceService.activate(scope.userId, leadMagnet.id);
        }
      }
    } catch (seqErr) {
      // Email sequence failure is non-fatal — log and continue with warning
      logApiError('launch-lead-magnet/email-sequence', seqErr, {
        leadMagnetId: leadMagnet.id,
      });
    }
  }

  return {
    lead_magnet_id: leadMagnet.id,
    funnel_id: funnel.id,
    public_url: publicUrl,
    email_sequence_id: emailSequenceId,
  };
}

// ─── Error helper ───────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err)
    return (err as { statusCode: number }).statusCode;
  return 500;
}
