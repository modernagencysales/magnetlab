import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, isEmbeddingsConfigured } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';

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

    // Whitelist allowed fields
    const ALLOWED_FIELDS = ['content', 'category', 'speaker', 'context'] as const;
    const filtered: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        filtered[key] = body[key];
      }
    }

    // Handle tags separately (need to manage tag counts)
    const newTags: string[] | undefined = body.tags;

    if (Object.keys(filtered).length === 0 && !newTags) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    // Fetch current entry (for tag diff and embedding regeneration)
    const { data: current, error: fetchError } = await supabase
      .from('cp_knowledge_entries')
      .select('id, user_id, content, context, tags')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Handle tag count updates
    if (newTags) {
      const oldTags: string[] = current.tags || [];
      const removedTags = oldTags.filter((t: string) => !newTags.includes(t));
      const addedTags = newTags.filter((t: string) => !oldTags.includes(t));

      // Decrement removed tags
      for (const tag of removedTags) {
        await supabase.rpc('cp_decrement_tag_count', {
          p_user_id: session.user.id,
          p_tag_name: tag,
        });
      }

      // Increment added tags
      for (const tag of addedTags) {
        await supabase.rpc('cp_increment_tag_count', {
          p_user_id: session.user.id,
          p_tag_name: tag,
        });
      }

      filtered.tags = newTags;
    }

    // Regenerate embedding if content or context changed
    const contentChanged = 'content' in filtered && filtered.content !== current.content;
    const contextChanged = 'context' in filtered && filtered.context !== current.context;

    if ((contentChanged || contextChanged) && isEmbeddingsConfigured()) {
      const newContent = (filtered.content as string) || current.content;
      const newContext = (filtered.context as string) || current.context;
      const embeddingText = newContext ? `${newContent}\n\n${newContext}` : newContent;
      try {
        const embedding = await generateEmbedding(embeddingText);
        filtered.embedding = JSON.stringify(embedding);
      } catch {
        // Non-fatal: update without embedding refresh
      }
    }

    filtered.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('cp_knowledge_entries')
      .update(filtered)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (error) {
    logError('cp/knowledge', error, { step: 'knowledge_update_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    // Fetch entry to get tags for decrement
    const { data: entry } = await supabase
      .from('cp_knowledge_entries')
      .select('id, user_id, tags')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Decrement tag counts before deleting
    const tags: string[] = entry.tags || [];
    for (const tag of tags) {
      await supabase.rpc('cp_decrement_tag_count', {
        p_user_id: session.user.id,
        p_tag_name: tag,
      });
    }

    // Delete the entry
    const { error } = await supabase
      .from('cp_knowledge_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/knowledge', error, { step: 'knowledge_delete_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
