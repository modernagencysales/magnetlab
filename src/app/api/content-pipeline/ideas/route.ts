import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const pillar = searchParams.get('pillar');
    const contentType = searchParams.get('content_type');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const VALID_STATUSES = ['extracted', 'selected', 'writing', 'written', 'scheduled', 'published', 'archived'];
    const VALID_PILLARS = ['moments_that_matter', 'teaching_promotion', 'human_personal', 'collaboration_social_proof'];
    const VALID_CONTENT_TYPES = ['story', 'insight', 'tip', 'framework', 'case_study', 'question', 'listicle', 'contrarian'];

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }
    if (pillar && !VALID_PILLARS.includes(pillar)) {
      return NextResponse.json({ error: 'Invalid pillar value' }, { status: 400 });
    }
    if (contentType && !VALID_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json({ error: 'Invalid content_type value' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_content_ideas')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (pillar) query = query.eq('content_pillar', pillar);
    if (contentType) query = query.eq('content_type', contentType);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch ideas:', error.message);
      return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 });
    }

    return NextResponse.json({ ideas: data || [] });
  } catch (error) {
    console.error('Ideas list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
