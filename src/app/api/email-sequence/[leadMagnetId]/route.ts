// API Route: Email Sequence CRUD
// GET, PUT /api/email-sequence/[leadMagnetId]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { EmailSequenceRow } from '@/lib/types/email';
import { ApiErrors, logApiError } from '@/lib/api/errors';

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

    // First verify the lead magnet belongs to the user
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id')
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Get the email sequence
    const { data, error } = await supabase
      .from('email_sequences')
      .select('*')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

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

    // Verify the sequence belongs to the user
    const { data: existingSequence, error: findError } = await supabase
      .from('email_sequences')
      .select('id')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (findError || !existingSequence) {
      return ApiErrors.notFound('Email sequence');
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (emails) {
      // When emails are edited, reset sync status
      updateData.emails = emails;
      updateData.status = 'draft';
      updateData.loops_synced_at = null;
      updateData.loops_transactional_ids = [];
    } else if (status) {
      // Just updating status (e.g., pausing/resuming)
      updateData.status = status;
    }

    // Update the sequence
    const { data, error } = await supabase
      .from('email_sequences')
      .update(updateData)
      .eq('id', existingSequence.id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      logApiError('email-sequence/update', error, { leadMagnetId });
      return ApiErrors.databaseError('Failed to update email sequence');
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(data as EmailSequenceRow),
    });
  } catch (error) {
    logApiError('email-sequence/update', error);
    return ApiErrors.internalError('Failed to update email sequence');
  }
}
