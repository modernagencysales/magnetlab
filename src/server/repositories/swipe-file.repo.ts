/**
 * Swipe File Repository (swipe_file_lead_magnets, swipe_file_posts)
 * ALL Supabase for public listing and submit.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface ListFilters {
  niche?: string;
  format?: string;
  featured?: boolean;
  limit: number;
  offset: number;
}

export async function listLeadMagnets(filters: ListFilters & { postType?: never }) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('swipe_file_lead_magnets')
    .select('*', { count: 'exact' })
    .in('status', ['approved', 'featured'])
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  if (filters.niche) query = query.eq('niche', filters.niche);
  if (filters.format) query = query.eq('format', filters.format);
  if (filters.featured) query = query.eq('status', 'featured');
  const { data, error, count } = await query;
  if (error) throw new Error(`swipe-file.listLeadMagnets: ${error.message}`);
  return { data: data ?? [], count: count ?? 0 };
}

export async function listPosts(filters: ListFilters & { postType?: string }) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('swipe_file_posts')
    .select('*', { count: 'exact' })
    .in('status', ['approved', 'featured'])
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  if (filters.niche) query = query.eq('niche', filters.niche);
  if (filters.postType) query = query.eq('post_type', filters.postType);
  if (filters.featured) query = query.eq('status', 'featured');
  const { data, error, count } = await query;
  if (error) throw new Error(`swipe-file.listPosts: ${error.message}`);
  return { data: data ?? [], count: count ?? 0 };
}

export async function submitPost(userId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('swipe_file_posts')
    .insert({
      ...payload,
      submitted_by: userId,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw new Error(`swipe-file.submitPost: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function submitLeadMagnet(userId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('swipe_file_lead_magnets')
    .insert({
      ...payload,
      submitted_by: userId,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw new Error(`swipe-file.submitLeadMagnet: ${error.message}`);
  return data as Record<string, unknown>;
}
