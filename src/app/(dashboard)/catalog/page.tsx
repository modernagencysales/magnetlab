import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { checkTeamRole } from '@/lib/auth/rbac';
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
  const activeTeamId = cookieStore.get('ml-team-context')?.value;

  // Catalog requires a team context — redirect to team-select if none
  if (!activeTeamId) {
    redirect('/team-select');
  }

  // Verify membership
  const role = await checkTeamRole(session.user.id, activeTeamId);
  if (!role) {
    redirect('/team-select');
  }

  // Get team owner for username lookup
  const { data: team } = await supabase
    .from('teams')
    .select('id, owner_id')
    .eq('id', activeTeamId)
    .single();

  if (!team) redirect('/team-select');

  // Fetch catalog data scoped to team
  const { data: magnets } = await supabase
    .from('lead_magnets')
    .select('id, title, archetype, pain_point, target_audience, short_description, status, created_at')
    .eq('team_id', activeTeamId)
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
    .eq('id', team.owner_id)
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
        id: team.owner_id,
        name: ownerUser?.name || null,
        username: ownerUser?.username || null,
      }}
      isOwner={role === 'owner'}
    />
  );
}
