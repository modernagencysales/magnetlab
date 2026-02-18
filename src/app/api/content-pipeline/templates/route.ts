import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';

import { logError } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const scope = searchParams.get('scope'); // 'global' | 'mine' | null (default: all visible)

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_post_templates')
      .select('id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, is_global, source, created_at, updated_at')
      .eq('is_active', true);

    if (scope === 'global') {
      // Only global templates
      query = query.eq('is_global', true);
    } else if (scope === 'mine') {
      // Only user's own non-global templates
      query = query.eq('user_id', session.user.id).eq('is_global', false);
    } else {
      // Default: user's own templates + global templates
      query = query.or(`user_id.eq.${session.user.id},is_global.eq.true`);
    }

    query = query.order('usage_count', { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    logError('cp/templates', error, { step: 'templates_list_error' });
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
    const { name, category, description, structure, example_posts, use_cases, tags } = body;

    if (!name || !structure) {
      return NextResponse.json({ error: 'name and structure are required' }, { status: 400 });
    }

    // Generate embedding for the template
    let embedding: number[] | null = null;
    try {
      const embeddingText = createTemplateEmbeddingText({ name, category, description, structure, use_cases, tags });
      embedding = await generateEmbedding(embeddingText);
    } catch {
      // Continue without embedding if it fails
    }

    const supabase = createSupabaseAdminClient();

    const insertData: Record<string, unknown> = {
      user_id: session.user.id,
      name,
      category: category || null,
      description: description || null,
      structure,
      example_posts: example_posts || null,
      use_cases: use_cases || null,
      tags: tags || null,
    };
    if (embedding) {
      insertData.embedding = JSON.stringify(embedding);
    }

    const { data, error } = await supabase
      .from('cp_post_templates')
      .insert(insertData)
      .select('id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, is_global, source, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (error) {
    logError('cp/templates', error, { step: 'template_create_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
