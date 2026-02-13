import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// GET: engagement stats + recent engagements for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Verify post ownership
    const { data: post, error: postErr } = await supabase
      .from('cp_pipeline_posts')
      .select('id, scrape_engagement, heyreach_campaign_id, last_engagement_scrape_at, engagement_scrape_count')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Get engagement counts
    const { count: commentCount } = await supabase
      .from('cp_post_engagements')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .eq('engagement_type', 'comment');

    const { count: reactionCount } = await supabase
      .from('cp_post_engagements')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .eq('engagement_type', 'reaction');

    const { count: resolvedCount } = await supabase
      .from('cp_post_engagements')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .not('linkedin_url', 'is', null);

    const { count: pushedCount } = await supabase
      .from('cp_post_engagements')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .not('heyreach_pushed_at', 'is', null);

    // Recent engagements
    const { data: recentEngagements } = await supabase
      .from('cp_post_engagements')
      .select('id, provider_id, engagement_type, reaction_type, comment_text, first_name, last_name, linkedin_url, heyreach_pushed_at, engaged_at, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      config: {
        scrape_engagement: post.scrape_engagement,
        heyreach_campaign_id: post.heyreach_campaign_id,
        last_engagement_scrape_at: post.last_engagement_scrape_at,
        engagement_scrape_count: post.engagement_scrape_count,
      },
      stats: {
        comments: commentCount || 0,
        reactions: reactionCount || 0,
        resolved: resolvedCount || 0,
        pushed: pushedCount || 0,
      },
      engagements: recentEngagements || [],
    });
  } catch (error) {
    console.error('Engagement fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: toggle scrape_engagement + set heyreach_campaign_id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    const updates: Record<string, unknown> = {};

    if ('scrape_engagement' in body && typeof body.scrape_engagement === 'boolean') {
      updates.scrape_engagement = body.scrape_engagement;
    }
    if ('heyreach_campaign_id' in body) {
      updates.heyreach_campaign_id = body.heyreach_campaign_id || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cp_pipeline_posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id, scrape_engagement, heyreach_campaign_id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Engagement config update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
