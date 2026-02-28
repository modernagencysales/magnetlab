/**
 * Public Repository
 * Supabase access for unauthenticated/public routes: page_views, funnel_leads,
 * funnel_pages (public read), external_resource_clicks, users (username lookup), qualification_questions.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/** Count leads by IP since timestamp (for rate limiting). */
export async function countLeadsByIpSince(ip: string, sinceIso: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('funnel_leads')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('created_at', sinceIso);
  if (error) return 0;
  return count ?? 0;
}

/** Get funnel page by ID for lead capture (must be published). */
export async function findFunnelPageByIdForLead(funnelPageId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, user_id, lead_magnet_id, slug, is_published, team_id, send_resource_email')
    .eq('id', funnelPageId)
    .single();
  if (error || !data) return null;
  return data;
}

/** Insert a funnel lead. */
export async function insertFunnelLead(row: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_leads')
    .insert(row)
    .select()
    .single();
  return { data, error };
}

/** Update funnel lead with qualification answers. */
export async function updateFunnelLeadQualification(
  leadId: string,
  updates: { qualification_answers?: unknown; is_qualified?: boolean; linkedin_profile_url?: string | null }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_leads')
    .update(updates)
    .eq('id', leadId)
    .select()
    .single();
  return { data, error };
}

/** Get funnel page by ID (minimal) for library_id lookup. */
export async function findFunnelPageLibraryId(funnelPageId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_pages')
    .select('library_id')
    .eq('id', funnelPageId)
    .single();
  return data?.library_id ?? null;
}

/** Upsert page view (ignore duplicates). */
export async function upsertPageView(
  funnelPageId: string,
  visitorHash: string,
  viewDate: string,
  pageType: string
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('page_views').upsert(
    {
      funnel_page_id: funnelPageId,
      visitor_hash: visitorHash,
      view_date: viewDate,
      page_type: pageType,
    },
    { onConflict: 'funnel_page_id,visitor_hash,view_date,page_type', ignoreDuplicates: true }
  );
  return { error };
}

/** Insert external resource click. */
export async function insertExternalResourceClick(
  resourceId: string,
  funnelPageId: string | null,
  libraryId: string | null
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('external_resource_clicks').insert({
    external_resource_id: resourceId,
    funnel_page_id: funnelPageId,
    library_id: libraryId,
  });
  return { error };
}

/** Find user by username (public profile). */
export async function findUserByUsername(username: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('users')
    .select('id, username, name, avatar_url')
    .eq('username', username)
    .single();
  return data ?? null;
}

/** Find published funnel page by user_id and slug. */
export async function findPublishedFunnelByUserAndSlug(userId: string, slug: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_pages')
    .select(
      'id, slug, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, lead_magnet_id, is_published, qualification_form_id'
    )
    .eq('user_id', userId)
    .eq('slug', slug)
    .single();
  return data ?? null;
}

/** Get lead magnet title by id. */
export async function findLeadMagnetTitle(leadMagnetId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('title')
    .eq('id', leadMagnetId)
    .single();
  return data?.title ?? null;
}

/** Get qualification questions for public form (by funnel_page_id or form_id). */
export async function getPublicQuestionsForFunnelPage(
  funnelPageId: string,
  qualificationFormId: string | null
) {
  const supabase = createSupabaseAdminClient();
  const selectFields = 'id, question_text, question_order, answer_type, options, placeholder, is_required';
  const query =
    qualificationFormId
      ? supabase
          .from('qualification_questions')
          .select(selectFields)
          .eq('form_id', qualificationFormId)
          .order('question_order', { ascending: true })
      : supabase
          .from('qualification_questions')
          .select(selectFields)
          .eq('funnel_page_id', funnelPageId)
          .order('question_order', { ascending: true });
  const { data, error } = await query;
  if (error) return { questions: null, error: error.message };
  return { questions: data ?? [], error: null };
}

/** Get funnel page for public questions check (is_published, qualification_form_id). */
export async function findFunnelPageForPublicQuestions(funnelPageId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, is_published, qualification_form_id')
    .eq('id', funnelPageId)
    .single();
  if (error || !data) return null;
  return data;
}

// ─── Webhook: Resend email events ───────────────────────────────────────────

/** Find most recent funnel lead by email (for Resend webhook). */
export async function findLeadByEmailForWebhook(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_leads')
    .select('id, user_id, lead_magnet_id')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

/** Insert email_events row (Resend webhook). */
export async function insertEmailEvent(row: {
  email_id: string;
  lead_id: string;
  lead_magnet_id: string | null;
  user_id: string;
  event_type: string;
  recipient_email: string;
  subject: string | null;
  link_url: string | null;
  bounce_type: string | null;
  metadata: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  return await supabase.from('email_events').insert(row);
}
