import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateHookVariants } from '@/lib/ai/content-pipeline/hook-generator';
import { logError } from '@/lib/utils/logger';
import type { PostVariation } from '@/lib/types/content-pipeline';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Fetch the post (scoped to user)
    const { data: post, error: fetchError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, final_content, draft_content, variations')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const content = post.final_content || post.draft_content;
    if (!content) {
      return NextResponse.json({ error: 'Post has no content to generate variants from' }, { status: 400 });
    }

    // Generate hook variants via AI
    const hookVariants = await generateHookVariants(content);

    // Format as PostVariation[]
    const now = Date.now();
    const variations: PostVariation[] = hookVariants.map((variant, i) => ({
      id: `hook-variant-${i}-${now}`,
      content: variant.content,
      hook_type: variant.hook_type,
      selected: false,
    }));

    // Merge with existing variations (keep existing, append new)
    const existingVariations: PostVariation[] = Array.isArray(post.variations)
      ? post.variations
      : [];
    const mergedVariations = [...existingVariations, ...variations];

    // Save variations back to the post
    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({ variations: mergedVariations })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (updateError) {
      logError('cp/hook-variants', updateError, { step: 'update_variations', postId: id });
    }

    return NextResponse.json({ variants: variations });
  } catch (error) {
    logError('cp/hook-variants', error, { step: 'hook_variants_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
