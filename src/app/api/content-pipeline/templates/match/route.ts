import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, cosineSimilarity } from '@/lib/ai/embeddings';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, limit = 5 } = body;

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Generate embedding for the input text
    const queryEmbedding = await generateEmbedding(text);

    // Fetch all active templates with embeddings for this user
    const { data: templates, error } = await supabase
      .from('cp_post_templates')
      .select('id, name, category, description, structure, use_cases, tags, embedding')
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Calculate similarity and rank
    const matches = templates
      .filter((t) => t.embedding)
      .map((t) => {
        const templateEmbedding = typeof t.embedding === 'string'
          ? JSON.parse(t.embedding)
          : t.embedding;
        const similarity = cosineSimilarity(queryEmbedding, templateEmbedding);
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          description: t.description,
          structure: t.structure,
          similarity,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('Template match error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
