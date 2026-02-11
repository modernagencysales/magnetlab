import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { CatalogView } from '@/components/catalog/CatalogView';

export const metadata = {
  title: 'Catalog | MagnetLab',
  description: 'Lead magnet catalog for your team',
};

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const supabase = createSupabaseAdminClient();
  const cookieStore = await cookies();
  const activeOwnerId = cookieStore.get('ml-team-context')?.value;

  // Check if user has team memberships
  const { data: memberships, error: membershipError } = await supabase
    .from('team_members')
    .select('id, owner_id')
    .eq('member_id', session.user.id)
    .eq('status', 'active');

  if (membershipError) {
    console.error('[Catalog] Failed to fetch memberships:', membershipError.message);
  }

  const hasMemberships = memberships && memberships.length > 0;

  // Determine which owner's catalog to show
  let ownerId: string;

  if (activeOwnerId && activeOwnerId !== session.user.id) {
    // Verify active membership
    const isValidMembership = memberships?.some(m => m.owner_id === activeOwnerId);
    if (!isValidMembership) {
      // Invalid cookie, clear and show own catalog
      ownerId = session.user.id;
    } else {
      ownerId = activeOwnerId;
    }
  } else if (!activeOwnerId && hasMemberships && memberships.length > 1) {
    // Multiple memberships, no selection — redirect to team select
    redirect('/team-select');
  } else if (!activeOwnerId && hasMemberships && memberships.length === 1) {
    // Single membership — show that owner's catalog
    ownerId = memberships[0].owner_id;
  } else {
    // No memberships or viewing own catalog
    ownerId = session.user.id;
  }

  // Fetch catalog data
  const { data: magnets } = await supabase
    .from('lead_magnets')
    .select('id, title, archetype, pain_point, target_audience, short_description, status, created_at')
    .eq('user_id', ownerId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

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

  return (
    <CatalogView
      catalog={catalog}
      owner={{
        id: ownerId,
        name: ownerUser?.name || null,
        username: ownerUser?.username || null,
      }}
      isOwner={ownerId === session.user.id}
    />
  );
}
