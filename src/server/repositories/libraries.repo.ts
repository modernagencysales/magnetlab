/**
 * Libraries Repository
 * All Supabase access for libraries and library items.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { LibraryRow } from '@/lib/types/library';

const LIBRARY_SELECT = 'id, user_id, name, description, icon, slug, auto_feature_days, created_at, updated_at';

export async function listLibraries(userId: string, limit: number, offset: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('libraries')
    .select(LIBRARY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return { data: (data ?? []) as LibraryRow[], error };
}

export async function findSlugInUse(userId: string, slug: string, excludeId?: string) {
  const supabase = createSupabaseAdminClient();
  let q = supabase.from('libraries').select('id').eq('user_id', userId).eq('slug', slug);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q.single();
  return !!data;
}

export async function createLibrary(params: {
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  slug: string;
  autoFeatureDays: number;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('libraries')
    .insert({
      user_id: params.userId,
      name: params.name,
      description: params.description,
      icon: params.icon,
      slug: params.slug,
      auto_feature_days: params.autoFeatureDays,
    })
    .select()
    .single();
  return { data: data as LibraryRow | null, error };
}

export async function getLibraryById(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('libraries')
    .select(LIBRARY_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function getLibraryWithItems(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: lib, error: libError } = await supabase
    .from('libraries')
    .select(LIBRARY_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (libError || !lib) return { data: null, error: libError };

  const { data: itemsData } = await supabase
    .from('library_items')
    .select(`
      id,
      asset_type,
      lead_magnet_id,
      external_resource_id,
      icon_override,
      sort_order,
      is_featured,
      lead_magnets:lead_magnet_id(id, title),
      external_resources:external_resource_id(id, title, icon)
    `)
    .eq('library_id', id)
    .order('sort_order', { ascending: true });

  const items = (itemsData || []).map((item: Record<string, unknown>) => {
    const lm = item.lead_magnets as { id: string; title: string } | null;
    const er = item.external_resources as { id: string; title: string; icon: string } | null;
    return {
      id: item.id,
      assetType: item.asset_type,
      assetId: lm?.id || er?.id || '',
      assetTitle: lm?.title || er?.title || 'Unknown',
      iconOverride: item.icon_override,
      sortOrder: item.sort_order,
      isFeatured: item.is_featured,
    };
  });

  return { data: { library: lib as LibraryRow, items }, error: null };
}

export async function updateLibrary(
  id: string,
  userId: string,
  update: Partial<{ name: string; description: string | null; icon: string; slug: string; auto_feature_days: number }>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('libraries')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data: data as LibraryRow | null, error };
}

export async function deleteLibrary(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('libraries').delete().eq('id', id).eq('user_id', userId);
  return { error };
}

// ----- Library items -----

export async function getLibraryMeta(libraryId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('libraries')
    .select('id, auto_feature_days')
    .eq('id', libraryId)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function listLibraryItems(libraryId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('library_items')
    .select(`
      *,
      lead_magnets:lead_magnet_id (id, title, slug),
      external_resources:external_resource_id (id, title, url, icon)
    `)
    .eq('library_id', libraryId)
    .order('sort_order', { ascending: true });
  return { data: data ?? [], error };
}

export async function getMaxSortOrder(libraryId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('library_items')
    .select('sort_order')
    .eq('library_id', libraryId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  return (data?.sort_order ?? -1) + 1;
}

export async function addLibraryItem(params: {
  libraryId: string;
  assetType: 'lead_magnet' | 'external_resource';
  leadMagnetId: string | null;
  externalResourceId: string | null;
  iconOverride: string | null;
  sortOrder: number;
  isFeatured: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('library_items')
    .insert({
      library_id: params.libraryId,
      asset_type: params.assetType,
      lead_magnet_id: params.leadMagnetId,
      external_resource_id: params.externalResourceId,
      icon_override: params.iconOverride,
      sort_order: params.sortOrder,
      is_featured: params.isFeatured,
    })
    .select()
    .single();
  return { data, error };
}

export async function getLibraryItem(itemId: string, libraryId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('library_items')
    .select('id')
    .eq('id', itemId)
    .eq('library_id', libraryId)
    .single();
  return { data, error };
}

export async function updateLibraryItem(
  itemId: string,
  libraryId: string,
  update: Partial<{ icon_override: string | null; sort_order: number; is_featured: boolean }>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('library_items')
    .update(update)
    .eq('id', itemId)
    .eq('library_id', libraryId)
    .select()
    .single();
  return { data, error };
}

export async function deleteLibraryItem(itemId: string, libraryId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('library_items').delete().eq('id', itemId).eq('library_id', libraryId);
  return { error };
}

export async function reorderLibraryItems(libraryId: string, items: Array<{ id: string; sort_order: number }>) {
  const supabase = createSupabaseAdminClient();
  const results = await Promise.all(
    items.map((item) =>
      supabase.from('library_items').update({ sort_order: item.sort_order }).eq('id', item.id).eq('library_id', libraryId)
    )
  );
  const firstError = results.find((r) => r.error)?.error;
  return { error: firstError ?? null };
}

export async function getLeadMagnetByIdForUser(leadMagnetId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('lead_magnets').select('id').eq('id', leadMagnetId).eq('user_id', userId).single();
  return { found: !!data };
}

export async function getExternalResourceByIdForUser(externalResourceId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('external_resources')
    .select('id')
    .eq('id', externalResourceId)
    .eq('user_id', userId)
    .single();
  return { found: !!data };
}
