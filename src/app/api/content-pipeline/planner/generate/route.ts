import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateWeekPlan } from '@/lib/ai/content-pipeline/week-planner';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { week_start_date, posts_per_week, pillar_distribution } = body;

    if (!week_start_date) {
      return NextResponse.json({ error: 'week_start_date is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch ideas, templates, slots, business context in parallel
    const [ideasResult, templatesResult, slotsResult, contextResult, recentPostsResult] = await Promise.all([
      supabase
        .from('cp_content_ideas')
        .select('id, user_id, transcript_id, title, core_insight, why_post_worthy, full_context, content_type, content_pillar, relevance_score, status, post_ready, hook, key_points, target_audience, source_quote, composite_score, last_surfaced_at, similarity_hash, created_at, updated_at')
        .eq('user_id', session.user.id)
        .in('status', ['extracted', 'selected'])
        .order('composite_score', { ascending: false })
        .limit(50),
      supabase
        .from('cp_post_templates')
        .select('*') // TODO: replace with explicit columns once cp_post_templates schema is confirmed
        .eq('user_id', session.user.id)
        .eq('is_active', true),
      supabase
        .from('cp_posting_slots')
        .select('id, user_id, slot_number, time_of_day, day_of_week, timezone, is_active, created_at, updated_at')
        .eq('user_id', session.user.id)
        .eq('is_active', true),
      supabase
        .from('cp_business_context')
        .select('id, user_id, company_name, industry, company_description, icp_title, icp_industry, icp_pain_points, target_audience, content_preferences, created_at, updated_at')
        .eq('user_id', session.user.id)
        .single(),
      supabase
        .from('cp_pipeline_posts')
        .select('draft_content')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const ideas = ideasResult.data || [];
    const templates = templatesResult.data || [];
    const slots = slotsResult.data || [];
    const businessContext = contextResult.data || null;
    const recentPostTitles = (recentPostsResult.data || [])
      .map((p) => p.draft_content?.substring(0, 100) || '')
      .filter(Boolean);

    if (ideas.length === 0) {
      return NextResponse.json({ error: 'No ideas available. Process some transcripts first.' }, { status: 400 });
    }

    const dist = pillar_distribution || {
      moments_that_matter: 25,
      teaching_promotion: 35,
      human_personal: 20,
      collaboration_social_proof: 20,
    };

    const result = await generateWeekPlan({
      userId: session.user.id,
      weekStartDate: week_start_date,
      postsPerWeek: posts_per_week || 5,
      pillarDistribution: dist,
      ideas,
      templates,
      slots,
      businessContext,
      recentPostTitles,
    });

    // Save as draft plan
    const { data: plan, error } = await supabase
      .from('cp_week_plans')
      .upsert({
        user_id: session.user.id,
        week_start_date,
        posts_per_week: posts_per_week || 5,
        pillar_moments_pct: dist.moments_that_matter,
        pillar_teaching_pct: dist.teaching_promotion,
        pillar_human_pct: dist.human_personal,
        pillar_collab_pct: dist.collaboration_social_proof,
        planned_posts: result.plannedPosts,
        generation_notes: result.generationNotes,
        status: 'draft',
      }, { onConflict: 'user_id,week_start_date' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ plan, notes: result.generationNotes });
  } catch (error) {
    console.error('Planner generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
