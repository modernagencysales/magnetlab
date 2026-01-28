// API Route: Activate Email Sequence
// POST /api/email-sequence/[leadMagnetId]/activate

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { EmailSequenceRow } from '@/lib/types/email';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

// POST - Activate email sequence (make it live for new leads)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadMagnetId } = await params;
    const supabase = await createSupabaseServerClient();

    // Get the email sequence
    const { data: sequenceData, error: seqError } = await supabase
      .from('email_sequences')
      .select('*')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (seqError || !sequenceData) {
      return NextResponse.json({ error: 'Email sequence not found' }, { status: 404 });
    }

    const sequence = emailSequenceFromRow(sequenceData as EmailSequenceRow);

    if (!sequence.emails || sequence.emails.length === 0) {
      return NextResponse.json(
        { error: 'No emails in sequence. Generate emails first.' },
        { status: 400 }
      );
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
      console.error('Activate sequence error:', updateError);
      return NextResponse.json(
        { error: 'Failed to activate sequence' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(updatedSequence as EmailSequenceRow),
      message: 'Email sequence activated! New leads will automatically receive the welcome sequence.',
    });
  } catch (error) {
    console.error('Activate email sequence error:', error);
    return NextResponse.json(
      { error: 'Failed to activate email sequence' },
      { status: 500 }
    );
  }
}
