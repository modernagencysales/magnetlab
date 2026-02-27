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
      .from('signal_configs')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      // PGRST116 = no rows found — not an error, just no config yet
      if (error.code === 'PGRST116') {
        return NextResponse.json({ config: null });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    logError('api/signals/config', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('signal_configs')
      .upsert(
        {
          user_id: session.user.id,
          target_countries: body.target_countries ?? [],
          target_job_titles: body.target_job_titles ?? [],
          exclude_job_titles: body.exclude_job_titles ?? [],
          min_company_size: body.min_company_size ?? null,
          max_company_size: body.max_company_size ?? null,
          target_industries: body.target_industries ?? [],
          default_heyreach_campaign_id: body.default_heyreach_campaign_id ?? null,
          enrichment_enabled: body.enrichment_enabled ?? true,
          sentiment_scoring_enabled: body.sentiment_scoring_enabled ?? true,
          auto_push_enabled: body.auto_push_enabled ?? false,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    logError('api/signals/config', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
