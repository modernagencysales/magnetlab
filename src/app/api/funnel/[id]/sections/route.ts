import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageSectionFromRow, type FunnelPageSectionRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import {
  validateBody,
  createSectionSchema,
  sectionConfigSchemas,
} from '@/lib/validations/api';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List all sections for a funnel page
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await applyScope(
      supabase
        .from('funnel_pages')
        .select('id')
        .eq('id', id),
      scope
    ).single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    const { data, error } = await supabase
      .from('funnel_page_sections')
      .select('id, funnel_page_id, section_type, page_location, sort_order, is_visible, config, created_at, updated_at')
      .eq('funnel_page_id', id)
      .order('page_location')
      .order('sort_order', { ascending: true });

    if (error) {
      logApiError('funnel/sections/list', error, { funnelId: id });
      return ApiErrors.databaseError('Failed to fetch sections');
    }

    const sections = (data as FunnelPageSectionRow[]).map(funnelPageSectionFromRow);

    return NextResponse.json({ sections });
  } catch (error) {
    logApiError('funnel/sections/list', error);
    return ApiErrors.internalError('Failed to fetch sections');
  }
}

// POST - Create a new section
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Validate base fields
    const validation = validateBody(body, createSectionSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error);
    }

    const { sectionType, pageLocation, sortOrder, isVisible, config } = validation.data;

    // Validate config against type-specific schema
    const configSchema = sectionConfigSchemas[sectionType as keyof typeof sectionConfigSchemas];
    if (configSchema) {
      const configValidation = configSchema.safeParse(config);
      if (!configValidation.success) {
        return ApiErrors.validationError(
          `Invalid config for ${sectionType}: ${configValidation.error.issues[0]?.message}`
        );
      }
    }

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await applyScope(
      supabase
        .from('funnel_pages')
        .select('id')
        .eq('id', id),
      scope
    ).single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Determine sort_order if not provided
    let finalSortOrder = sortOrder ?? 0;
    if (sortOrder === undefined) {
      const { data: maxResult } = await supabase
        .from('funnel_page_sections')
        .select('sort_order')
        .eq('funnel_page_id', id)
        .eq('page_location', pageLocation)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      finalSortOrder = (maxResult?.sort_order ?? -1) + 1;
    }

    const { data, error } = await supabase
      .from('funnel_page_sections')
      .insert({
        funnel_page_id: id,
        section_type: sectionType,
        page_location: pageLocation,
        sort_order: finalSortOrder,
        is_visible: isVisible ?? true,
        config,
      })
      .select()
      .single();

    if (error) {
      logApiError('funnel/sections/create', error, { funnelId: id });
      return ApiErrors.databaseError('Failed to create section');
    }

    return NextResponse.json(
      { section: funnelPageSectionFromRow(data as FunnelPageSectionRow) },
      { status: 201 }
    );
  } catch (error) {
    logApiError('funnel/sections/create', error);
    return ApiErrors.internalError('Failed to create section');
  }
}
