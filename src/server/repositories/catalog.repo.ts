/**
 * Catalog Repository
 * Lead magnets list for catalog view with funnel slugs and owner info. Scoped by team/user.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

export interface CatalogMagnetRow {
  id: string;
  title: string;
  archetype: string | null;
  pain_point: string | null;
  target_audience: string | null;
  short_description: string | null;
  status: string;
  created_at: string;
}

export interface FunnelSlugRow {
  lead_magnet_id: string;
  slug: string;
  is_published: boolean;
}

export interface OwnerRow {
  username: string | null;
  name: string | null;
}

export async function findCatalogMagnets(scope: DataScope): Promise<CatalogMagnetRow[]> {
  const supabase = createSupabaseAdminClient();
  const query = applyScope(
    supabase
      .from('lead_magnets')
      .select('id, title, archetype, pain_point, target_audience, short_description, status, created_at'),
    scope
  );
  const { data, error } = await query
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`catalog.findCatalogMagnets: ${error.message}`);
  return (data ?? []) as CatalogMagnetRow[];
}

export async function findFunnelSlugsByMagnetIds(magnetIds: string[]): Promise<FunnelSlugRow[]> {
  if (magnetIds.length === 0) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('lead_magnet_id, slug, is_published')
    .in('lead_magnet_id', magnetIds);

  if (error) throw new Error(`catalog.findFunnelSlugsByMagnetIds: ${error.message}`);
  return (data ?? []) as FunnelSlugRow[];
}

export async function findOwnerById(ownerId: string): Promise<OwnerRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('username, name')
    .eq('id', ownerId)
    .single();

  if (error) throw new Error(`catalog.findOwnerById: ${error.message}`);
  return data as OwnerRow;
}
