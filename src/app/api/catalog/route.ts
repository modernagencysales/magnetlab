import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const scope = await getDataScope(session.user.id);
  const supabase = createSupabaseAdminClient();

  // In team mode, the "owner" is the team owner; in personal mode, it's the user
  const ownerId = scope.ownerId || session.user.id;

  // Fetch lead magnets with catalog fields, scoped by team or user
  let magnetsQuery = supabase
    .from('lead_magnets')
    .select('id, title, archetype, pain_point, target_audience, short_description, status, created_at');
  magnetsQuery = applyScope(magnetsQuery, scope);
  const { data: magnets, error } = await magnetsQuery
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
