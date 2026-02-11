import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const ownerIdParam = request.nextUrl.searchParams.get('owner_id');
  const ownerId = ownerIdParam || session.user.id;

  if (ownerIdParam && !isValidUUID(ownerIdParam)) {
    return ApiErrors.validationError('Invalid owner_id');
  }

  const supabase = createSupabaseAdminClient();

  // If viewing another owner's catalog, verify membership
  if (ownerId !== session.user.id) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('member_id', session.user.id)
      .eq('status', 'active')
      .single();

    if (!membership) {
      return ApiErrors.forbidden('You are not a member of this team');
    }
  }

  // Fetch lead magnets with catalog fields
  const { data: magnets, error } = await supabase
    .from('lead_magnets')
    .select('id, title, archetype, pain_point, target_audience, short_description, status, created_at')
    .eq('user_id', ownerId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (error) {
    logApiError('catalog-list', error, { userId: session.user.id, ownerId });
    return ApiErrors.databaseError();
  }

  // Fetch funnel pages to resolve public URLs
  const magnetIds = (magnets || []).map(m => m.id);
  let funnelMap: Record<string, { slug: string; is_published: boolean }> = {};

  if (magnetIds.length > 0) {
    const { data: funnels } = await supabase
      .from('funnel_pages')
      .select('lead_magnet_id, slug, is_published')
      .in('lead_magnet_id', magnetIds);

    if (funnels) {
      funnelMap = Object.fromEntries(
        funnels.map(f => [f.lead_magnet_id, { slug: f.slug, is_published: f.is_published }])
      );
    }
  }

  // Fetch owner's username for URL construction
  const { data: ownerUser } = await supabase
    .from('users')
    .select('username, name')
    .eq('id', ownerId)
    .single();

  const catalog = (magnets || []).map(m => ({
    ...m,
    funnelSlug: funnelMap[m.id]?.slug || null,
    funnelPublished: funnelMap[m.id]?.is_published || false,
    publicUrl: funnelMap[m.id]?.slug && funnelMap[m.id]?.is_published && ownerUser?.username
      ? `/p/${ownerUser.username}/${funnelMap[m.id].slug}`
      : null,
  }));

  return NextResponse.json({
    catalog,
    owner: {
      id: ownerId,
      name: ownerUser?.name || null,
      username: ownerUser?.username || null,
    },
    isOwner: ownerId === session.user.id,
  });
}
