import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

const VALID_SOURCE_TYPES = ['creator', 'search_term', 'hashtag', 'competitor'] as const;
type SourceType = typeof VALID_SOURCE_TYPES[number];

/**
 * GET /api/content-pipeline/inspiration/sources
 * List user's inspiration sources.
 * Query params: active_only (boolean)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = request.nextUrl;
    const activeOnly = searchParams.get('active_only') !== 'false'; // default true

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_inspiration_sources')
      .select('id, user_id, source_type, source_value, is_active, priority, last_pulled_at, created_at')
      .eq('user_id', session.user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      logApiError('content-pipeline/inspiration/sources', error);
      return ApiErrors.databaseError('Failed to fetch inspiration sources');
    }

    return NextResponse.json({ sources: data || [] });
  } catch (error) {
    logApiError('content-pipeline/inspiration/sources', error);
    return ApiErrors.internalError();
  }
}

/**
 * POST /api/content-pipeline/inspiration/sources
 * Add a new inspiration source (creator URL, search term, hashtag).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { source_type, source_value, priority } = body;

    // Validation
    if (!source_type || !VALID_SOURCE_TYPES.includes(source_type as SourceType)) {
      return ApiErrors.validationError(`source_type must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
    }

    if (!source_value || typeof source_value !== 'string' || source_value.trim().length === 0) {
      return ApiErrors.validationError('source_value is required');
    }

    const cleanValue = source_value.trim();

    // Type-specific validation
    if (source_type === 'creator' && !isValidUrl(cleanValue)) {
      return ApiErrors.validationError('Creator source_value must be a valid URL (e.g., LinkedIn profile URL)');
    }

    if (source_type === 'hashtag') {
      // Normalize hashtag
      const normalized = cleanValue.startsWith('#') ? cleanValue : `#${cleanValue}`;
      if (normalized.length < 2) {
        return ApiErrors.validationError('Hashtag must be at least 2 characters');
      }
    }

    const validPriority = priority !== undefined ? Math.max(1, Math.min(5, parseInt(priority, 10) || 3)) : 3;

    const supabase = createSupabaseAdminClient();

    // Check for existing source (unique constraint will also catch this)
    const { data: existing } = await supabase
      .from('cp_inspiration_sources')
      .select('id, is_active')
      .eq('user_id', session.user.id)
      .eq('source_type', source_type)
      .eq('source_value', cleanValue)
      .maybeSingle();

    if (existing) {
      // Reactivate if it was deactivated
      if (!existing.is_active) {
        const { data, error } = await supabase
          .from('cp_inspiration_sources')
          .update({ is_active: true, priority: validPriority })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          logApiError('content-pipeline/inspiration/sources', error);
          return ApiErrors.databaseError('Failed to reactivate source');
        }

        return NextResponse.json({ source: data, reactivated: true });
      }

      return ApiErrors.conflict('This inspiration source already exists');
    }

    const { data, error } = await supabase
      .from('cp_inspiration_sources')
      .insert({
        user_id: session.user.id,
        source_type,
        source_value: cleanValue,
        priority: validPriority,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return ApiErrors.conflict('This inspiration source already exists');
      }
      logApiError('content-pipeline/inspiration/sources', error);
      return ApiErrors.databaseError('Failed to create inspiration source');
    }

    return NextResponse.json({ source: data }, { status: 201 });
  } catch (error) {
    logApiError('content-pipeline/inspiration/sources', error);
    return ApiErrors.internalError();
  }
}

/**
 * DELETE /api/content-pipeline/inspiration/sources
 * Soft-delete a source (deactivate).
 * Body: { source_id: string, hard_delete?: boolean }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { source_id, hard_delete } = body;

    if (!source_id || !isValidUUID(source_id)) {
      return ApiErrors.validationError('Valid source_id is required');
    }

    const supabase = createSupabaseAdminClient();

    if (hard_delete) {
      const { error } = await supabase
        .from('cp_inspiration_sources')
        .delete()
        .eq('id', source_id)
        .eq('user_id', session.user.id);

      if (error) {
        logApiError('content-pipeline/inspiration/sources/delete', error);
        return ApiErrors.databaseError('Failed to delete source');
      }
    } else {
      // Soft delete (deactivate)
      const { error } = await supabase
        .from('cp_inspiration_sources')
        .update({ is_active: false })
        .eq('id', source_id)
        .eq('user_id', session.user.id);

      if (error) {
        logApiError('content-pipeline/inspiration/sources/deactivate', error);
        return ApiErrors.databaseError('Failed to deactivate source');
      }
    }

    return NextResponse.json({ message: hard_delete ? 'Source deleted' : 'Source deactivated' });
  } catch (error) {
    logApiError('content-pipeline/inspiration/sources', error);
    return ApiErrors.internalError();
  }
}

/**
 * PATCH /api/content-pipeline/inspiration/sources
 * Update source (priority, active status).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { source_id, priority, is_active } = body;

    if (!source_id || !isValidUUID(source_id)) {
      return ApiErrors.validationError('Valid source_id is required');
    }

    const supabase = createSupabaseAdminClient();

    const updates: Record<string, unknown> = {};
    if (priority !== undefined) {
      updates.priority = Math.max(1, Math.min(5, parseInt(priority, 10) || 3));
    }
    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active);
    }

    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError('At least one field to update is required');
    }

    const { data, error } = await supabase
      .from('cp_inspiration_sources')
      .update(updates)
      .eq('id', source_id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error || !data) {
      return ApiErrors.notFound('Inspiration source');
    }

    return NextResponse.json({ source: data });
  } catch (error) {
    logApiError('content-pipeline/inspiration/sources', error);
    return ApiErrors.internalError();
  }
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
