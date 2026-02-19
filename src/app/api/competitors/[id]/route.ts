import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ('is_active' in body && typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }
    if ('heyreach_campaign_id' in body) {
      updates.heyreach_campaign_id = body.heyreach_campaign_id || null;
    }

    const { data, error } = await supabase
      .from('cp_monitored_competitors')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }

    return NextResponse.json({ competitor: data });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('cp_monitored_competitors')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
