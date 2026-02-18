import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding } from '@/lib/ai/embeddings';

import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { topic, text, count = 5, minSimilarity = 0.3 } = body;

    // Support both 'topic' (new) and 'text' (legacy) field names
    const topicText = topic || text;

    if (!topicText) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }

    // Generate embedding for the topic text
    const embedding = await generateEmbedding(topicText);

    const supabase = createSupabaseAdminClient();

    // Use the cp_match_templates RPC for server-side pgvector similarity search
    // This returns user's own templates + global templates above the similarity threshold
    const { data, error } = await supabase.rpc('cp_match_templates', {
      query_embedding: JSON.stringify(embedding),
      match_user_id: session.user.id,
      match_count: count,
      min_similarity: minSimilarity,
    });

    if (error) {
      logError('cp/templates', new Error('cp_match_templates RPC failed'), {
        detail: error.message,
        userId: session.user.id,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ matches: data || [] });
  } catch (error) {
    logError('cp/templates', error, { step: 'template_match_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
