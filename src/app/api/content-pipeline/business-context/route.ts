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
      .from('cp_business_context')
      .select('id, user_id, company_name, industry, company_description, icp_title, icp_industry, icp_pain_points, target_audience, content_preferences, created_at, updated_at')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ context: data || null });
  } catch (error) {
    logError('cp/business-context', error, { step: 'business_context_get_error' });
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

    const upsertData = {
      user_id: session.user.id,
      company_name: body.company_name || null,
      industry: body.industry || null,
      company_description: body.company_description || null,
      icp_title: body.icp_title || null,
      icp_industry: body.icp_industry || null,
      icp_pain_points: body.icp_pain_points || [],
      target_audience: body.target_audience || null,
      content_preferences: body.content_preferences || {},
    };

    const { data, error } = await supabase
      .from('cp_business_context')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ context: data });
  } catch (error) {
    logError('cp/business-context', error, { step: 'business_context_upsert_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
