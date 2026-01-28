// API Route: Email Sequence CRUD
// GET, PUT /api/email-sequence/[leadMagnetId]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';
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
    const supabase = await createSupabaseServerClient();

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
    const { emails } = body;

    if (!emails || !Array.isArray(emails)) {
      return ApiErrors.validationError('emails array is required');
    }

    // Validate email structure
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      if (typeof email.day !== 'number' ||
          typeof email.subject !== 'string' ||
          typeof email.body !== 'string' ||
          typeof email.replyTrigger !== 'string') {
        return ApiErrors.validationError(`Invalid email at index ${i}`);
      }
    }

    const supabase = await createSupabaseServerClient();

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

    // Update the sequence
    const { data, error } = await supabase
      .from('email_sequences')
      .update({
        emails,
        // Reset sync status when emails are edited
        status: 'draft',
        loops_synced_at: null,
        loops_transactional_ids: [],
      })
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
