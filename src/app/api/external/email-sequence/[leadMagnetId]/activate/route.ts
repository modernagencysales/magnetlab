// API Route: External Email Sequence Activation
// POST /api/external/email-sequence/[leadMagnetId]/activate
//
// Activates an email sequence (sets status to 'active').
// Uses Bearer token auth (EXTERNAL_API_KEY) instead of session auth.
// Accepts userId in the request body instead of reading from session.

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { EmailSequenceRow } from '@/lib/types/email';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    // Step 1: Authenticate via Bearer token
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    // Step 2: Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { userId } = body as { userId?: string };

    if (!userId || typeof userId !== 'string') {
      return ApiErrors.validationError('userId is required');
    }

    // Step 3: Get leadMagnetId from URL params
    const { leadMagnetId } = await params;

    const supabase = createSupabaseAdminClient();

    // Step 4: Get the email sequence
    const { data: sequenceData, error: seqError } = await supabase
      .from('email_sequences')
      .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', userId)
      .single();

    if (seqError || !sequenceData) {
      return ApiErrors.notFound('Email sequence');
    }

    const sequence = emailSequenceFromRow(sequenceData as EmailSequenceRow);

    // Step 5: Validate sequence has emails
    if (!sequence.emails || sequence.emails.length === 0) {
      return ApiErrors.validationError('No emails in sequence. Generate emails first.');
    }

    // Step 6: Update status to active
    const { data: updatedSequence, error: updateError } = await supabase
      .from('email_sequences')
      .update({ status: 'active' })
      .eq('id', sequence.id)
      .eq('user_id', userId)
      .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
      .single();

    if (updateError || !updatedSequence) {
      logApiError('external/email-sequence/activate', updateError, { leadMagnetId });
      return ApiErrors.databaseError('Failed to activate sequence');
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(updatedSequence as EmailSequenceRow),
      message: 'Email sequence activated.',
    });
  } catch (error) {
    logApiError('external/email-sequence/activate', error);
    return ApiErrors.internalError('Failed to activate email sequence');
  }
}
