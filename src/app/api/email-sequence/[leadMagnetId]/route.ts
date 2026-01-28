// API Route: Email Sequence CRUD
// GET, PUT /api/email-sequence/[leadMagnetId]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { EmailSequenceRow } from '@/lib/types/email';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

// GET - Get email sequence for a lead magnet
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 });
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
      console.error('Get email sequence error:', error);
      return NextResponse.json({ error: 'Failed to get email sequence' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ emailSequence: null });
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(data as EmailSequenceRow),
    });
  } catch (error) {
    console.error('Get email sequence error:', error);
    return NextResponse.json({ error: 'Failed to get email sequence' }, { status: 500 });
  }
}

// PUT - Update email sequence
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadMagnetId } = await params;
    const body = await request.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      );
    }

    // Validate email structure
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      if (typeof email.day !== 'number' ||
          typeof email.subject !== 'string' ||
          typeof email.body !== 'string' ||
          typeof email.replyTrigger !== 'string') {
        return NextResponse.json(
          { error: `Invalid email at index ${i}` },
          { status: 400 }
        );
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
      return NextResponse.json({ error: 'Email sequence not found' }, { status: 404 });
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
      console.error('Update email sequence error:', error);
      return NextResponse.json({ error: 'Failed to update email sequence' }, { status: 500 });
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(data as EmailSequenceRow),
    });
  } catch (error) {
    console.error('Update email sequence error:', error);
    return NextResponse.json({ error: 'Failed to update email sequence' }, { status: 500 });
  }
}
