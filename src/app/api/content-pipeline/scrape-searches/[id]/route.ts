import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import { logError } from '@/lib/utils/logger';

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

    const { data: existing, error: lookupError } = await supabase
      .from('cp_scrape_searches')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('cp_scrape_searches')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/scrape-searches', error, { step: 'search_delete_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
