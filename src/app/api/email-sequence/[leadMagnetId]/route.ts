// API Route: Email Sequence CRUD
// GET, PUT /api/email-sequence/[leadMagnetId]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { EmailSequenceRow } from '@/lib/types/email';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { captureAndClassifyEdit } from '@/lib/services/edit-capture';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

// GET - Get email sequence for a lead magnet
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { leadMagnetId } = await params;
    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    // First verify the lead magnet belongs to the user/team
    let lmQuery = supabase
      .from('lead_magnets')
      .select('id')
      .eq('id', leadMagnetId);
    lmQuery = applyScope(lmQuery, scope);
    const { data: leadMagnet, error: lmError } = await lmQuery.single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Get the email sequence
    let seqQuery = supabase
      .from('email_sequences')
      .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
      .eq('lead_magnet_id', leadMagnetId);
    seqQuery = applyScope(seqQuery, scope);
    const { data, error } = await seqQuery.single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's expected if no sequence exists
      logApiError('email-sequence/get', error, { leadMagnetId });
      return ApiErrors.databaseError('Failed to get email sequence');
    }

    if (!data) {
      return NextResponse.json({ emailSequence: null });
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(data as EmailSequenceRow),
    });
  } catch (error) {
    logApiError('email-sequence/get', error);
    return ApiErrors.internalError('Failed to get email sequence');
  }
}

// PUT - Update email sequence
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { leadMagnetId } = await params;
    const body = await request.json();
    const { emails, status } = body;

    // Require at least one field to update
    if (!emails && !status) {
      return ApiErrors.validationError('emails array or status is required');
    }

    // Validate email structure if provided
    if (emails) {
      if (!Array.isArray(emails)) {
        return ApiErrors.validationError('emails must be an array');
      }
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        if (typeof email.day !== 'number' ||
            typeof email.subject !== 'string' ||
            typeof email.body !== 'string' ||
            typeof email.replyTrigger !== 'string') {
          return ApiErrors.validationError(`Invalid email at index ${i}`);
        }
      }
    }

    // Validate status if provided
    if (status && !['draft', 'synced', 'active'].includes(status)) {
      return ApiErrors.validationError('status must be draft, synced, or active');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    // Verify the sequence belongs to the user/team
    // Also fetch current emails for edit diff comparison
    let findQuery = supabase
      .from('email_sequences')
      .select('id, emails')
      .eq('lead_magnet_id', leadMagnetId);
    findQuery = applyScope(findQuery, scope);
    const { data: existingSequence, error: findError } = await findQuery.maybeSingle();

    if (findError) {
      logApiError('email-sequence/update/find', findError, { leadMagnetId, userId: session.user.id });
      return ApiErrors.databaseError('Failed to look up email sequence');
    }

    if (!existingSequence) {
      logApiError('email-sequence/update/not-found', new Error('No matching email sequence'), {
        leadMagnetId,
        userId: session.user.id,
      });
      return ApiErrors.notFound('Email sequence');
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (emails) {
      // When emails are edited, reset sync status
      updateData.emails = emails;
      updateData.status = 'draft';
    } else if (status) {
      // Just updating status (e.g., pausing/resuming)
      updateData.status = status;
    }

    // Update the sequence
    let updateQuery = supabase
      .from('email_sequences')
      .update(updateData)
      .eq('id', existingSequence.id);
    updateQuery = applyScope(updateQuery, scope);
    const { data, error } = await updateQuery.select().single();

    if (error) {
      logApiError('email-sequence/update', error, { leadMagnetId });
      return ApiErrors.databaseError('Failed to update email sequence');
    }

    // Capture edits with async classification (never blocks the response)
    if (emails && scope.teamId && existingSequence.emails && Array.isArray(existingSequence.emails)) {
      try {
        const oldEmails = existingSequence.emails as Array<{ day: number; subject: string; body: string }>;
        const newEmails = emails as Array<{ day: number; subject: string; body: string }>;
        const sequenceId = existingSequence.id;

        for (let i = 0; i < newEmails.length; i++) {
          const oldEmail = oldEmails[i];
          const newEmail = newEmails[i];
          if (oldEmail && newEmail) {
            if (oldEmail.subject !== newEmail.subject) {
              captureAndClassifyEdit(supabase, {
                teamId: scope.teamId,
                profileId: null,
                contentType: 'sequence',
                contentId: sequenceId,
                fieldName: `email_${i}_subject`,
                originalText: oldEmail.subject,
                editedText: newEmail.subject,
              }).catch(() => {});
            }
            if (oldEmail.body !== newEmail.body) {
              captureAndClassifyEdit(supabase, {
                teamId: scope.teamId,
                profileId: null,
                contentType: 'sequence',
                contentId: sequenceId,
                fieldName: `email_${i}_body`,
                originalText: oldEmail.body,
                editedText: newEmail.body,
              }).catch(() => {});
            }
          }
        }
      } catch {
        // Edit capture must never affect the save flow
      }
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(data as EmailSequenceRow),
    });
  } catch (error) {
    logApiError('email-sequence/update', error);
    return ApiErrors.internalError('Failed to update email sequence');
  }
}
