import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('funnel_pages')
      .select(`
        id,
        slug,
        optin_headline,
        is_published,
        published_at,
        created_at,
        target_type,
        lead_magnet_id,
        library_id,
        external_resource_id,
        lead_magnets (
          title
        ),
        libraries (
          name,
          icon
        ),
        external_resources (
          title,
          icon
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logApiError('funnel/all', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch pages');
    }

    return NextResponse.json({ funnels: data });
  } catch (error) {
    logApiError('funnel/all', error);
    return ApiErrors.internalError('Failed to fetch pages');
  }
}
