import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';

import { logError } from '@/lib/utils/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_post_templates')
      .select('id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, created_at, updated_at')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

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
      .select('id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, created_at, updated_at')
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
