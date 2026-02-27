import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

const MAX_COMPANIES = 10;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('signal_company_monitors')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ companies: data || [] });
  } catch (error) {
    logError('api/signals/companies', error);
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
    const linkedinCompanyUrl = (body.linkedin_company_url as string)?.trim();

    if (!linkedinCompanyUrl || !linkedinCompanyUrl.includes('linkedin.com/company/')) {
      return NextResponse.json(
        { error: 'Must be a LinkedIn company URL (must contain linkedin.com/company/)' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check limit
    const { count } = await supabase
      .from('signal_company_monitors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if ((count || 0) >= MAX_COMPANIES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_COMPANIES} company monitors allowed` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('signal_company_monitors')
      .insert({
        user_id: session.user.id,
        linkedin_company_url: linkedinCompanyUrl,
        heyreach_campaign_id: body.heyreach_campaign_id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Company already being monitored' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ company: data }, { status: 201 });
  } catch (error) {
    logError('api/signals/companies', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
