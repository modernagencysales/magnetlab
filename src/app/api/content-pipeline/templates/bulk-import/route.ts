import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';

import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { templates } = body;

    if (!Array.isArray(templates) || templates.length === 0) {
      return NextResponse.json({ error: 'templates array is required' }, { status: 400 });
    }

    if (templates.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 templates per import' }, { status: 400 });
    }

    // Validate required fields
    for (let i = 0; i < templates.length; i++) {
      if (!templates[i].name || !templates[i].structure) {
        return NextResponse.json({ error: `Template at index ${i} missing name or structure` }, { status: 400 });
      }
    }

    const supabase = createSupabaseAdminClient();

    // Generate embeddings in batches
    const insertData = [];
    for (const template of templates) {
      let embedding: number[] | null = null;
      try {
        const embeddingText = createTemplateEmbeddingText(template);
        embedding = await generateEmbedding(embeddingText);
      } catch {
        // Continue without embedding
      }

      const row: Record<string, unknown> = {
        user_id: session.user.id,
        name: template.name,
        category: template.category || null,
        description: template.description || null,
        structure: template.structure,
        example_posts: template.example_posts || null,
        use_cases: template.use_cases || null,
        tags: template.tags || null,
      };
      if (embedding) {
        row.embedding = JSON.stringify(embedding);
      }
      insertData.push(row);
    }

    const { data, error } = await supabase
      .from('cp_post_templates')
      .insert(insertData)
      .select('id, name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      imported: data?.length || 0,
      templates: data || [],
    }, { status: 201 });
  } catch (error) {
    logError('cp/templates', error, { step: 'template_bulk_import_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
