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

    const [runsResult, postsResult] = await Promise.all([
      supabase
        .from('cp_scrape_runs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('cp_viral_posts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('likes', { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      runs: runsResult.data || [],
      posts: postsResult.data || [],
    });
  } catch (error) {
    console.error('Scraper list error:', error);
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
    const { posts, target_url } = body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: 'posts array is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Create scrape run record
    const { data: run, error: runError } = await supabase
      .from('cp_scrape_runs')
      .insert({
        user_id: session.user.id,
        target_url: target_url || null,
        status: 'completed',
        posts_found: posts.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Failed to create scrape run' }, { status: 500 });
    }

    // Insert viral posts
    const viralPosts = posts.map((p: {
      author_name?: string;
      author_headline?: string;
      author_url?: string;
      content: string;
      likes?: number;
      comments?: number;
      shares?: number;
      views?: number;
    }) => ({
      user_id: session.user.id,
      scrape_run_id: run.id,
      author_name: p.author_name || null,
      author_headline: p.author_headline || null,
      author_url: p.author_url || null,
      content: p.content,
      likes: p.likes || 0,
      comments: p.comments || 0,
      shares: p.shares || 0,
      views: p.views || 0,
    }));

    const { data: insertedPosts, error: postsError } = await supabase
      .from('cp_viral_posts')
      .insert(viralPosts)
      .select();

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return NextResponse.json({
      run,
      posts: insertedPosts || [],
    }, { status: 201 });
  } catch (error) {
    console.error('Scraper import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
