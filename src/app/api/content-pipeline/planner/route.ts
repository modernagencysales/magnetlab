import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_week_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .order('week_start_date', { ascending: false })
      .limit(12);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ plans: data || [] });
  } catch (error) {
    console.error('Planner list error:', error);
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
    const { week_start_date, posts_per_week, pillar_moments_pct, pillar_teaching_pct, pillar_human_pct, pillar_collab_pct, planned_posts, generation_notes } = body;

    if (!week_start_date) {
      return NextResponse.json({ error: 'week_start_date is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_week_plans')
      .insert({
        user_id: session.user.id,
        week_start_date,
        posts_per_week: posts_per_week || 5,
        pillar_moments_pct: pillar_moments_pct ?? 25,
        pillar_teaching_pct: pillar_teaching_pct ?? 25,
        pillar_human_pct: pillar_human_pct ?? 25,
        pillar_collab_pct: pillar_collab_pct ?? 25,
        planned_posts: planned_posts || [],
        generation_notes: generation_notes || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A plan already exists for this week' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ plan: data }, { status: 201 });
  } catch (error) {
    console.error('Planner create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
