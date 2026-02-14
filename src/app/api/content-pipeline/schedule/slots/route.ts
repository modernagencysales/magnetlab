import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import { logError } from '@/lib/utils/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_posting_slots')
      .select('id, user_id, slot_number, time_of_day, day_of_week, timezone, is_active, created_at')
      .eq('user_id', session.user.id)
      .order('slot_number', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ slots: data });
  } catch (error) {
    logError('cp/schedule/slots', error, { step: 'slots_fetch_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { time_of_day, day_of_week, timezone } = body;

    const timeMatch = time_of_day?.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch || parseInt(timeMatch[1]) > 23 || parseInt(timeMatch[2]) > 59) {
      return NextResponse.json({ error: 'time_of_day required in HH:MM format (00:00-23:59)' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Get next slot number
    const { data: existing } = await supabase
      .from('cp_posting_slots')
      .select('slot_number')
      .eq('user_id', session.user.id)
      .order('slot_number', { ascending: false })
      .limit(1);

    const nextSlot = (existing?.[0]?.slot_number || 0) + 1;

    const { data, error } = await supabase
      .from('cp_posting_slots')
      .insert({
        user_id: session.user.id,
        slot_number: nextSlot,
        time_of_day,
        day_of_week: day_of_week ?? null,
        timezone: timezone || 'UTC',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ slot: data }, { status: 201 });
  } catch (error) {
    logError('cp/schedule/slots', error, { step: 'slot_create_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
