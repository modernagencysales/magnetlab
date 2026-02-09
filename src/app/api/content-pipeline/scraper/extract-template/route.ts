import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { extractTemplateFromPost } from '@/lib/ai/content-pipeline/template-extractor';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, viral_post_id } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Extract template from the post content
    const extracted = await extractTemplateFromPost(content);

    // Generate embedding
    let embedding: number[] | null = null;
    try {
      const embeddingText = createTemplateEmbeddingText(extracted);
      embedding = await generateEmbedding(embeddingText);
    } catch {
      // Continue without embedding
    }

    const supabase = createSupabaseAdminClient();

    const insertData: Record<string, unknown> = {
      user_id: session.user.id,
      name: extracted.name,
      category: extracted.category,
      structure: extracted.structure,
      use_cases: extracted.use_cases,
      tags: extracted.tags,
    };
    if (embedding) {
      insertData.embedding = JSON.stringify(embedding);
    }

    const { data: template, error } = await supabase
      .from('cp_post_templates')
      .insert(insertData)
      .select('id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Link template to viral post if provided
    if (viral_post_id && template) {
      await supabase
        .from('cp_viral_posts')
        .update({ extracted_template_id: template.id })
        .eq('id', viral_post_id)
        .eq('user_id', session.user.id);
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Template extraction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
