import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { scrapeProfilePosts } from '@/lib/integrations/apify-engagers';
import { extractWritingStyle } from '@/lib/ai/style-extractor';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';

function normalizeLinkedInUrl(input: string): string {
  const trimmed = input.trim();

  // Handle /in/slug format
  if (trimmed.startsWith('/in/')) {
    return `https://www.linkedin.com${trimmed}`;
  }

  // Handle in/slug format (no leading slash)
  if (trimmed.startsWith('in/')) {
    return `https://www.linkedin.com/${trimmed}`;
  }

  // Handle bare slug (no slashes, no http)
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return `https://www.linkedin.com/in/${trimmed}`;
  }

  // Already a full URL
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { linkedin_url, author_name } = body;

    if (!linkedin_url || typeof linkedin_url !== 'string') {
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 });
    }

    const normalizedUrl = normalizeLinkedInUrl(linkedin_url);

    // Validate the normalized URL is actually a LinkedIn URL (SSRF prevention)
    try {
      const parsed = new URL(normalizedUrl);
      if (!['www.linkedin.com', 'linkedin.com'].includes(parsed.hostname)) {
        return NextResponse.json({ error: 'URL must be a LinkedIn profile' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Scrape recent posts from the profile
    const { data: posts, error: scrapeError } = await scrapeProfilePosts(normalizedUrl, 10);

    if (scrapeError) {
      return NextResponse.json({ error: `Failed to scrape profile: ${scrapeError}` }, { status: 502 });
    }

    // Filter to text posts with meaningful content
    const textPosts = posts.filter((p) => p.text && p.text.trim().length > 50);

    if (textPosts.length < 3) {
      return NextResponse.json(
        { error: `Only found ${textPosts.length} text posts (need at least 3). The profile may not have enough public posts.` },
        { status: 422 }
      );
    }

    // Get author info from first post if not provided
    const firstPost = textPosts[0];
    const authorName = author_name || firstPost.authorName || `${firstPost.author.firstName} ${firstPost.author.lastName}`.trim();
    const authorHeadline = firstPost.author.occupation || undefined;

    // Extract writing style using AI
    const extractedStyle = await extractWritingStyle({
      posts: textPosts.map((p) => p.text),
      authorName: authorName || undefined,
      authorHeadline,
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
      source_linkedin_url: normalizedUrl,
      source_posts_analyzed: textPosts.length,
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
      posts_analyzed: textPosts.length,
    }, { status: 201 });
  } catch (error) {
    logError('cp/styles', error, { step: 'extract_from_url_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
