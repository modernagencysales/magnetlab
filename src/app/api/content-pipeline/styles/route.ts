import { NextResponse } from 'next/server';
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
      .from('cp_writing_styles')
      .select('id, user_id, name, description, source_linkedin_url, source_posts_analyzed, style_profile, example_posts, is_active, last_updated_at, created_at')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ styles: data || [] });
  } catch (error) {
    logError('cp/styles', error, { step: 'styles_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
