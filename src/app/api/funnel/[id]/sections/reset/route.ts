import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageSectionFromRow, type FunnelPageSectionRow, type PageLocation } from '@/lib/types/funnel';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '@/lib/constants/funnel-templates';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const body = await request.json();
    const { pageLocation } = body;

    const validLocations: PageLocation[] = ['optin', 'thankyou', 'content'];
    if (!validLocations.includes(pageLocation)) {
      return ApiErrors.validationError('Invalid pageLocation');
    }

    const supabase = createSupabaseAdminClient();

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Get user's template preference
    const { data: user } = await supabase
      .from('users')
      .select('default_funnel_template')
      .eq('id', session.user.id)
      .single();

    const template = getTemplate(user?.default_funnel_template || DEFAULT_TEMPLATE_ID);

    // Delete existing sections for this page location
    await supabase
      .from('funnel_page_sections')
      .delete()
      .eq('funnel_page_id', id)
      .eq('page_location', pageLocation);

    // Insert template sections for this page location
    const templateSections = template.sections.filter(s => s.pageLocation === pageLocation);

    if (templateSections.length === 0) {
      return NextResponse.json({ sections: [] });
    }

    const sectionRows = templateSections.map(s => ({
      funnel_page_id: id,
      section_type: s.sectionType,
      page_location: s.pageLocation,
      sort_order: s.sortOrder,
      is_visible: true,
      config: s.config,
    }));

    const { data, error } = await supabase
      .from('funnel_page_sections')
      .insert(sectionRows)
      .select();

    if (error) {
      logApiError('funnel/sections/reset', error, { funnelId: id });
      return ApiErrors.databaseError('Failed to reset sections');
    }

    const sections = (data as FunnelPageSectionRow[]).map(funnelPageSectionFromRow);

    return NextResponse.json({ sections });
  } catch (error) {
    logApiError('funnel/sections/reset', error);
    return ApiErrors.internalError('Failed to reset sections');
  }
}
