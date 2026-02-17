// API Route: Lead Magnet CRUD
// GET, PUT, DELETE /api/lead-magnet/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single lead magnet
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('lead_magnets')
      .select('id, user_id, title, archetype, concept, extracted_content, generated_content, linkedin_post, post_variations, dm_template, cta_word, thumbnail_url, scheduled_time, polished_content, polished_at, status, published_at, created_at, updated_at')
      .eq('id', id);
    query = applyScope(query, scope);
    const { data, error } = await query.single();

    if (error || !data) {
      return ApiErrors.notFound('Lead magnet');
    }

    return NextResponse.json(data);
  } catch (error) {
    logApiError('lead-magnet/get', error);
    return ApiErrors.internalError('Failed to get lead magnet');
  }
}

// PUT - Update a lead magnet
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Remove fields that shouldn't be updated directly
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, user_id: _userId, team_id: _teamId, created_at: _createdAt, ...updateData } = body;

    let updateQuery = supabase
      .from('lead_magnets')
      .update(updateData)
      .eq('id', id);
    updateQuery = applyScope(updateQuery, scope);
    const { data, error } = await updateQuery
      .select()
      .single();

    if (error) {
      logApiError('lead-magnet/update', error, { userId: session.user.id, leadMagnetId: id });
      return ApiErrors.databaseError('Failed to update lead magnet');
    }

    return NextResponse.json(data);
  } catch (error) {
    logApiError('lead-magnet/update', error);
    return ApiErrors.internalError('Failed to update lead magnet');
  }
}

// DELETE - Delete a lead magnet with cascade
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // First verify ownership
    let findQuery = supabase
      .from('lead_magnets')
      .select('id')
      .eq('id', id);
    findQuery = applyScope(findQuery, scope);
    const { data: leadMagnet, error: findError } = await findQuery.single();

    if (findError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Get all funnel pages for this lead magnet
    const { data: funnels } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('lead_magnet_id', id);

    // Cascade delete related records for each funnel
    if (funnels && funnels.length > 0) {
      const funnelIds = funnels.map(f => f.id);

      // Delete questions, leads, and page views in parallel (no FK dependencies between them)
      await Promise.all([
        supabase.from('qualification_questions').delete().in('funnel_page_id', funnelIds),
        supabase.from('funnel_leads').delete().in('funnel_page_id', funnelIds),
        supabase.from('page_views').delete().in('funnel_page_id', funnelIds),
      ]);

      // Delete funnel pages (after child records are cleared)
      await supabase.from('funnel_pages').delete().eq('lead_magnet_id', id);
    }

    // Finally delete the lead magnet
    let deleteQuery = supabase
      .from('lead_magnets')
      .delete()
      .eq('id', id);
    deleteQuery = applyScope(deleteQuery, scope);
    const { error } = await deleteQuery;

    if (error) {
      logApiError('lead-magnet/delete', error, { userId: session.user.id, leadMagnetId: id });
      return ApiErrors.databaseError('Failed to delete lead magnet');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('lead-magnet/delete', error);
    return ApiErrors.internalError('Failed to delete lead magnet');
  }
}
