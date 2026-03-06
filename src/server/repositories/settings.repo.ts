/**
 * Settings Repository
 * All Supabase access for team-domain, team-email-domain, whitelabel, and custom-domain (funnel_pages).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function getTeamByOwnerId(ownerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', ownerId)
    .limit(1)
    .single();
  return { data, error };
}

// ----- Team domain (Vercel) -----
export async function getTeamDomain(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_domains')
    .select('id, domain, status, dns_config, last_checked_at, created_at')
    .eq('team_id', teamId)
    .single();
  return { data, error };
}

export async function getTeamDomainForDelete(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_domains')
    .select('id, domain')
    .eq('team_id', teamId)
    .single();
  return { data, error };
}

export async function getTeamDomainByDomain(domain: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_domains')
    .select('id, team_id')
    .eq('domain', domain)
    .single();
  return data;
}

export async function upsertTeamDomain(params: {
  teamId: string;
  domain: string;
  vercelDomainId: string;
  status: string;
  dnsConfig: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_domains')
    .upsert(
      {
        team_id: params.teamId,
        domain: params.domain,
        vercel_domain_id: params.vercelDomainId,
        status: params.status,
        dns_config: params.dnsConfig,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'team_id' }
    )
    .select('id, domain, status, dns_config, last_checked_at, created_at')
    .single();
  return { data, error };
}

export async function updateTeamDomainStatus(
  domainId: string,
  status: string,
  dnsConfig: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('team_domains')
    .update({
      status,
      dns_config: dnsConfig,
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', domainId);
  return { error };
}

export async function deleteTeamDomain(domainId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('team_domains').delete().eq('id', domainId);
  return { error };
}

export async function setTeamWhitelabelEnabled(teamId: string, enabled: boolean) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('teams').update({ whitelabel_enabled: enabled }).eq('id', teamId);
  return { error };
}

// ----- Team email domain (Resend) -----
export async function getTeamEmailDomain(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_email_domains')
    .select('id, domain, resend_domain_id, status, dns_records, region, last_checked_at, created_at')
    .eq('team_id', teamId)
    .single();
  return { data, error };
}

export async function getTeamEmailDomainForVerify(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_email_domains')
    .select('id, resend_domain_id')
    .eq('team_id', teamId)
    .single();
  return { data, error };
}

export async function getTeamEmailDomainForDelete(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_email_domains')
    .select('id, resend_domain_id')
    .eq('team_id', teamId)
    .single();
  return { data, error };
}

export async function getTeamEmailDomainByDomain(domain: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_email_domains')
    .select('id, team_id')
    .eq('domain', domain)
    .single();
  return data;
}

export async function upsertTeamEmailDomain(params: {
  teamId: string;
  domain: string;
  resendDomainId: string;
  status: string;
  dnsRecords: unknown;
  region: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_email_domains')
    .upsert(
      {
        team_id: params.teamId,
        domain: params.domain,
        resend_domain_id: params.resendDomainId,
        status: params.status,
        dns_records: params.dnsRecords,
        region: params.region,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'team_id' }
    )
    .select('id, domain, resend_domain_id, status, dns_records, region, last_checked_at, created_at')
    .single();
  return { data, error };
}

export async function updateTeamEmailDomainStatus(
  domainId: string,
  status: string,
  dnsRecords: unknown
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('team_email_domains')
    .update({
      status,
      dns_records: dnsRecords,
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', domainId);
  return { error };
}

export async function deleteTeamEmailDomain(domainId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('team_email_domains').delete().eq('id', domainId);
  return { error };
}

export async function setTeamCustomFromEmail(teamId: string, fromEmail: string | null) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('teams').update({ custom_from_email: fromEmail }).eq('id', teamId);
  return { error };
}

export async function getVerifiedTeamEmailDomain(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_email_domains')
    .select('id, domain')
    .eq('team_id', teamId)
    .eq('status', 'verified')
    .single();
  return { data, error };
}

// ----- Whitelabel -----
export async function getTeamWhitelabel(ownerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .select('id, whitelabel_enabled, hide_branding, custom_favicon_url, custom_site_name, custom_email_sender_name, custom_from_email')
    .eq('owner_id', ownerId)
    .limit(1)
    .single();
  return { data, error };
}

export async function updateTeamWhitelabel(
  teamId: string,
  payload: {
    hide_branding?: boolean;
    custom_favicon_url?: string | null;
    custom_site_name?: string | null;
    custom_email_sender_name?: string | null;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('teams')
    .update({
      hide_branding: payload.hide_branding ?? false,
      custom_favicon_url: payload.custom_favicon_url ?? null,
      custom_site_name: payload.custom_site_name ?? null,
      custom_email_sender_name: payload.custom_email_sender_name ?? null,
    })
    .eq('id', teamId);
  return { error };
}

// ----- Custom domain (funnel pages) -----
export async function listFunnelPagesWithCustomDomain(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, slug, custom_domain, is_published, target_type')
    .eq('user_id', userId)
    .not('custom_domain', 'is', null)
    .order('updated_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function getFunnelPageForUser(funnelPageId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, custom_domain')
    .eq('id', funnelPageId)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function getFunnelPageIdByCustomDomain(customDomain: string, excludeFunnelPageId?: string) {
  const supabase = createSupabaseAdminClient();
  let q = supabase.from('funnel_pages').select('id').eq('custom_domain', customDomain);
  if (excludeFunnelPageId) q = q.neq('id', excludeFunnelPageId);
  const { data } = await q.single();
  return data?.id ?? null;
}

export async function setFunnelPageCustomDomain(funnelPageId: string, domain: string | null) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_pages')
    .update({ custom_domain: domain })
    .eq('id', funnelPageId);
  return { error };
}
