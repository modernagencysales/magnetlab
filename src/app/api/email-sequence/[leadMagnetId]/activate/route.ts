// API Route: Activate Email Sequence
// POST /api/email-sequence/[leadMagnetId]/activate

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { EmailSequenceRow } from '@/lib/types/email';
import { ApiErrors, logApiError } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

// POST - Activate email sequence (make it live for new leads)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { leadMagnetId } = await params;
    const supabase = createSupabaseAdminClient();

    // Get the email sequence
    const { data: sequenceData, error: seqError } = await supabase
      .from('email_sequences')
      .select('*')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (seqError || !sequenceData) {
      return ApiErrors.notFound('Email sequence');
    }

    const sequence = emailSequenceFromRow(sequenceData as EmailSequenceRow);

    if (!sequence.emails || sequence.emails.length === 0) {
      return ApiErrors.validationError('No emails in sequence. Generate emails first.');
    }

    // Update status to active
    const { data: updatedSequence, error: updateError } = await supabase
      .from('email_sequences')
      .update({
        status: 'active',
      })
      .eq('id', sequence.id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (updateError) {
      logApiError('email-sequence/activate', updateError, { leadMagnetId });
      return ApiErrors.databaseError('Failed to activate sequence');
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(updatedSequence as EmailSequenceRow),
      message: 'Email sequence activated! New leads will automatically receive the welcome sequence.',
    });
  } catch (error) {
    logApiError('email-sequence/activate', error);
    return ApiErrors.internalError('Failed to activate email sequence');
  }
}
