import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { extractWritingStyle } from '@/lib/ai/style-extractor';
import { generateEmbedding } from '@/lib/ai/embeddings';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { posts, author_name, author_headline, source_linkedin_url } = body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: 'posts array is required (at least 1 post)' }, { status: 400 });
    }

    // Extract the writing style using AI
    const extractedStyle = await extractWritingStyle({
      posts,
      authorName: author_name,
      authorHeadline: author_headline,
    });

    // Generate embedding for the style
    let embedding: number[] | null = null;
    try {
      const embeddingText = `Style: ${extractedStyle.name}. ${extractedStyle.description}. Tone: ${extractedStyle.style_profile.tone}. Patterns: ${extractedStyle.style_profile.hook_patterns.join(', ')}`;
      embedding = await generateEmbedding(embeddingText);
    } catch {
      // Continue without embedding
    }

    const supabase = createSupabaseAdminClient();

    const insertData: Record<string, unknown> = {
      user_id: session.user.id,
      name: extractedStyle.name,
      description: extractedStyle.description,
      source_linkedin_url: source_linkedin_url || null,
      source_posts_analyzed: posts.length,
      style_profile: extractedStyle.style_profile,
      example_posts: extractedStyle.example_posts,
    };
    if (embedding) {
      insertData.embedding = JSON.stringify(embedding);
    }

    const { data, error } = await supabase
      .from('cp_writing_styles')
      .insert(insertData)
      .select('id, user_id, name, description, source_linkedin_url, source_posts_analyzed, style_profile, example_posts, is_active, last_updated_at, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      style: data,
      key_patterns: extractedStyle.key_patterns,
      recommendations: extractedStyle.recommendations,
    }, { status: 201 });
  } catch (error) {
    console.error('Style extract error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
