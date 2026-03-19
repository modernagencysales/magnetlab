/**
 * Scanner Sources Route.
 * GET    /api/content-pipeline/scanner/sources — list user's inspiration sources
 * POST   /api/content-pipeline/scanner/sources — add a new inspiration source
 * DELETE /api/content-pipeline/scanner/sources — remove a source by id
 * Never contains business logic; delegates to Supabase directly (thin CRUD layer).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_COLUMNS =
  'id, user_id, source_type, source_value, priority, is_active, last_pulled_at, created_at' as const;

// ─── Validation schemas ───────────────────────────────────────────────────────

const CreateSourceSchema = z.object({
  source_type: z.enum([
    'creator',
    'search_term',
    'hashtag',
    'competitor',
    'reddit_subreddit',
    'reddit_search',
  ]),
  source_value: z.string().min(1, 'source_value is required').max(500),
  priority: z.number().int().min(1).max(5).optional().default(3),
});

const DeleteSourceSchema = z.object({
  source_id: z.string().uuid('source_id must be a valid UUID'),
});

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_inspiration_sources')
      .select(SOURCE_COLUMNS)
      .eq('user_id', session.user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logError('api/scanner/sources', error, { step: 'list' });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ sources: data ?? [] });
  } catch (error) {
    logError('api/scanner/sources', error, { step: 'list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = CreateSourceSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        {
          error: firstError
            ? `${firstError.path.join('.')}: ${firstError.message}`
            : 'Invalid request',
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_inspiration_sources')
      .insert({
        user_id: session.user.id,
        source_type: parsed.data.source_type,
        source_value: parsed.data.source_value,
        priority: parsed.data.priority,
        is_active: true,
      })
      .select(SOURCE_COLUMNS)
      .maybeSingle();

    if (error) {
      // Unique constraint violation (user_id, source_type, source_value)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
      }
      logError('api/scanner/sources', error, { step: 'insert' });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ source: data }, { status: 201 });
  } catch (error) {
    logError('api/scanner/sources', error, { step: 'post_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE handler ───────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = DeleteSourceSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        {
          error: firstError
            ? `${firstError.path.join('.')}: ${firstError.message}`
            : 'Invalid request',
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { error, count } = await supabase
      .from('cp_inspiration_sources')
      .delete({ count: 'exact' })
      .eq('id', parsed.data.source_id)
      .eq('user_id', session.user.id);

    if (error) {
      logError('api/scanner/sources', error, { step: 'delete', sourceId: parsed.data.source_id });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logError('api/scanner/sources', error, { step: 'delete_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
