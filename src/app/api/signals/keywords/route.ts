import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

const MAX_KEYWORDS = 20;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('signal_keyword_monitors')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ keywords: data || [] });
  } catch (error) {
    logError('api/signals/keywords', error);
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
    const keyword = (body.keyword as string)?.trim();

    if (!keyword || keyword.length < 2) {
      return NextResponse.json(
        { error: 'Keyword must be at least 2 characters' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check limit
    const { count } = await supabase
      .from('signal_keyword_monitors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if ((count || 0) >= MAX_KEYWORDS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_KEYWORDS} keyword monitors allowed` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('signal_keyword_monitors')
      .insert({
        user_id: session.user.id,
        keyword,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Keyword already being monitored' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ keyword: data }, { status: 201 });
  } catch (error) {
    logError('api/signals/keywords', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
