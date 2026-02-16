// API Route: External Post Import for Intro Offer
// POST /api/external/import-posts
//
// Imports finished Blueprint posts into the magnetlab content pipeline
// (cp_pipeline_posts) for a given user. Authenticated via Bearer token.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external/import-posts/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function POST(request: Request) {
  try {
    if (!authenticateRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { user_id, team_profile_id, posts } = body as {
      user_id?: string;
      team_profile_id?: string;
      posts?: Array<{
        title?: string;
        content: string;
        funnel_stage?: string;
        source_post_id?: string;
      }>;
    };

    if (!user_id || !posts || !Array.isArray(posts) || posts.length === 0) {
      return ApiErrors.validationError('user_id and posts array are required');
    }

    const supabase = createSupabaseAdminClient();

    const rows = posts.map((post, idx) => ({
      user_id,
      team_profile_id: team_profile_id || null,
      status: 'reviewing', // Ready for human review
      draft_content: post.content,
      final_content: post.content,
      source: 'intro_offer',
      source_ref: post.source_post_id || null,
      metadata: {
        title: post.title || `Post ${idx + 1}`,
        funnel_stage: post.funnel_stage || null,
        imported_at: new Date().toISOString(),
      },
    }));

    const { data, error } = await supabase
      .from('cp_pipeline_posts')
      .insert(rows)
      .select('id, status');

    if (error) {
      logApiError('external/import-posts/insert', error);
      return ApiErrors.internalError('Failed to import posts');
    }

    return NextResponse.json({
      success: true,
      data: { imported_count: data.length, posts: data },
    }, { status: 201 });
  } catch (error) {
    logApiError('external/import-posts', error);
    return ApiErrors.internalError('Failed to import posts');
  }
}
