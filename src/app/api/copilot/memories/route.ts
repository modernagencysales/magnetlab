import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const VALID_CATEGORIES = ['tone', 'structure', 'vocabulary', 'content', 'general'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const activeParam = req.nextUrl.searchParams.get('active');

  let query = supabase
    .from('copilot_memories')
    .select('id, rule, category, confidence, source, active, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (activeParam !== null) {
    query = query.eq('active', activeParam === 'true');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ memories: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rule, category } = await req.json();

  if (!rule || typeof rule !== 'string' || !rule.trim()) {
    return NextResponse.json({ error: 'rule is required' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('copilot_memories')
    .insert({
      user_id: session.user.id,
      rule: rule.trim(),
      category,
      confidence: 1.0,
      source: 'manual',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ memory: data });
}
