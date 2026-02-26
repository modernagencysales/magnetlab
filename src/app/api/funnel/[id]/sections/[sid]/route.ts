import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { funnelPageSectionFromRow, type FunnelPageSectionRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { validateBody, updateSectionSchema, sectionConfigSchemas } from '@/lib/validations/api';
import { normalizeSectionConfigImageUrls } from '@/lib/utils/normalize-image-url';

interface RouteParams {
  params: Promise<{ id: string; sid: string }>;
}

// PUT - Update a section
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id, sid } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    const validation = validateBody(body, updateSectionSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error);
    }

    // Verify funnel ownership
    let funnelQuery = supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id);
    funnelQuery = applyScope(funnelQuery, scope);
    const { data: funnel, error: funnelError } = await funnelQuery.single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Get existing section to know its type (needed for config validation and image URL normalization)
    let existingSectionType = '';
    if (validation.data.config) {
      const { data: existing } = await supabase
        .from('funnel_page_sections')
        .select('section_type')
        .eq('id', sid)
        .eq('funnel_page_id', id)
        .single();

      if (existing) {
        existingSectionType = existing.section_type;
        const configSchema = sectionConfigSchemas[existing.section_type as keyof typeof sectionConfigSchemas];
        if (configSchema) {
          const configValidation = configSchema.safeParse(validation.data.config);
          if (!configValidation.success) {
            return ApiErrors.validationError(
              `Invalid config: ${configValidation.error.issues[0]?.message}`
            );
          }
        }
      }
    }

    // Build update object
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (validation.data.sortOrder !== undefined) update.sort_order = validation.data.sortOrder;
    if (validation.data.isVisible !== undefined) update.is_visible = validation.data.isVisible;
    if (validation.data.pageLocation !== undefined) update.page_location = validation.data.pageLocation;
    if (validation.data.config !== undefined) {
      update.config = normalizeSectionConfigImageUrls(existingSectionType, validation.data.config as Record<string, unknown>);
    }

    const { data, error } = await supabase
      .from('funnel_page_sections')
      .update(update)
      .eq('id', sid)
      .eq('funnel_page_id', id)
      .select()
      .single();

    if (error) {
      logApiError('funnel/sections/update', error, { funnelId: id, sectionId: sid });
      return ApiErrors.databaseError('Failed to update section');
    }

    return NextResponse.json({ section: funnelPageSectionFromRow(data as FunnelPageSectionRow) });
  } catch (error) {
    logApiError('funnel/sections/update', error);
    return ApiErrors.internalError('Failed to update section');
  }
}

// DELETE - Remove a section
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id, sid } = await params;
    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    // Verify funnel ownership
    let funnelQuery = supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id);
    funnelQuery = applyScope(funnelQuery, scope);
    const { data: funnel, error: funnelError } = await funnelQuery.single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    const { error } = await supabase
      .from('funnel_page_sections')
      .delete()
      .eq('id', sid)
      .eq('funnel_page_id', id);

    if (error) {
      logApiError('funnel/sections/delete', error, { funnelId: id, sectionId: sid });
      return ApiErrors.databaseError('Failed to delete section');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('funnel/sections/delete', error);
    return ApiErrors.internalError('Failed to delete section');
  }
}
