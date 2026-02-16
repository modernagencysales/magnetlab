import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { LibraryPageClient } from '@/components/library/LibraryPageClient';
import type { Metadata } from 'next';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ leadId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (!user) return { title: 'Page Not Found' };

  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('library_id')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('target_type', 'library')
    .single();

  if (!funnel?.library_id) return { title: 'Page Not Found' };

  const { data: library } = await supabase
    .from('libraries')
    .select('name, description')
    .eq('id', funnel.library_id)
    .single();

  if (!library) return { title: 'Page Not Found' };

  return {
    title: library.name,
    description: library.description || `Access the ${library.name} resource library`,
  };
}

interface LibraryItemRow {
  id: string;
  asset_type: string;
  icon_override: string | null;
  sort_order: number;
  is_featured: boolean;
  added_at: string;
  // Supabase returns single object for foreign key references
  lead_magnets: { id: string; title: string; slug?: string } | null;
  external_resources: { id: string; title: string; url: string; icon: string } | null;
}


export default async function PublicLibraryPage({ params, searchParams }: PageProps) {
  const { username, slug } = await params;
  const { leadId } = await searchParams;
  const supabase = createSupabaseAdminClient();

  // Find user
  const { data: user } = await supabase
    .from('users')
    .select('id, name, avatar_url')
    .eq('username', username)
    .single();

  if (!user) notFound();

  // Find published funnel with library target
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select(`
      id,
      slug,
      library_id,
      theme,
      primary_color,
      logo_url,
      calendly_url
    `)
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('target_type', 'library')
    .single();

  if (!funnel?.library_id) notFound();

  // Get library
  const { data: library } = await supabase
    .from('libraries')
    .select('id, name, description, icon, auto_feature_days')
    .eq('id', funnel.library_id)
    .single();

  if (!library) notFound();

  // Get library items with asset data
  const { data: itemRows } = await supabase
    .from('library_items')
    .select(`
      id,
      asset_type,
      icon_override,
      sort_order,
      is_featured,
      added_at,
      lead_magnets:lead_magnet_id (id, title, slug),
      external_resources:external_resource_id (id, title, url, icon)
    `)
    .eq('library_id', library.id)
    .order('sort_order', { ascending: true });

  // Calculate "new" cutoff
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (library.auto_feature_days || 14));

  // Transform items for display
  const items = ((itemRows || []) as unknown as LibraryItemRow[])
    .map((row) => {
      const addedAt = new Date(row.added_at);
      const isNew = addedAt > cutoffDate;

      if (row.asset_type === 'lead_magnet' && row.lead_magnets) {
        return {
          id: row.id,
          assetType: 'lead_magnet' as const,
          title: row.lead_magnets.title,
          icon: row.icon_override || '📄',
          slug: row.lead_magnets.slug || row.lead_magnets.id,
          externalUrl: null,
          isFeatured: row.is_featured,
          isNew,
          sortOrder: row.sort_order,
          resourceId: null,
        };
      } else if (row.asset_type === 'external_resource' && row.external_resources) {
        return {
          id: row.id,
          assetType: 'external_resource' as const,
          title: row.external_resources.title,
          icon: row.icon_override || row.external_resources.icon || '🔗',
          slug: null,
          externalUrl: row.external_resources.url,
          isFeatured: row.is_featured,
          isNew,
          sortOrder: row.sort_order,
          resourceId: row.external_resources.id,
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Check if lead has completed survey
  let hasCompletedSurvey = false;
  if (leadId) {
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('qualification_answers')
      .eq('id', leadId)
      .single();
    hasCompletedSurvey = lead?.qualification_answers && Object.keys(lead.qualification_answers).length > 0;
  }

  // Check if funnel has questions
  let hasQuestions = false;
  if (funnel.calendly_url) {
    const { count } = await supabase
      .from('qualification_questions')
      .select('*', { count: 'exact', head: true })
      .eq('funnel_page_id', funnel.id);
    hasQuestions = (count ?? 0) > 0;
  }

  return (
    <LibraryPageClient
      library={{
        id: library.id,
        name: library.name,
        description: library.description,
        icon: library.icon,
      }}
      items={items}
      funnelSlug={funnel.slug}
      username={username}
      userName={user.name}
      userAvatar={user.avatar_url}
      theme={(funnel.theme as 'dark' | 'light') || 'dark'}
      primaryColor={funnel.primary_color || '#8b5cf6'}
      logoUrl={funnel.logo_url}
      hasQuestions={hasQuestions}
      leadId={leadId || null}
      hasCompletedSurvey={hasCompletedSurvey}
      funnelPageId={funnel.id}
    />
  );
}
