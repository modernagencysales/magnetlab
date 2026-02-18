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
      .from('cp_tracked_creators')
      .select('id, linkedin_url, name, headline, avatar_url, avg_engagement, post_count, added_by_user_id, is_active, last_scraped_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ creators: data || [] });
  } catch (error) {
    logError('cp/creators', error, { step: 'creators_list_error' });
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
    const { linkedin_url, name, headline } = body;

    if (!linkedin_url || typeof linkedin_url !== 'string') {
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Deduplicate by linkedin_url — if it already exists, return the existing record
    const { data: existing, error: lookupError } = await supabase
      .from('cp_tracked_creators')
      .select('id, linkedin_url, name, headline, avatar_url, avg_engagement, post_count, added_by_user_id, is_active, last_scraped_at, created_at')
      .eq('linkedin_url', linkedin_url)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({
        creator: existing,
        message: 'Creator already exists',
      });
    }

    const { data, error } = await supabase
      .from('cp_tracked_creators')
      .insert({
        linkedin_url,
        name: name || null,
        headline: headline || null,
        added_by_user_id: session.user.id,
      })
      .select('id, linkedin_url, name, headline, avatar_url, avg_engagement, post_count, added_by_user_id, is_active, last_scraped_at, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ creator: data }, { status: 201 });
  } catch (error) {
    logError('cp/creators', error, { step: 'creator_create_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
