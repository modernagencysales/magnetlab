/**
 * Settings Service
 * Team domain, team email domain, whitelabel, custom domain (funnel pages).
 */

import { getUserPlan } from '@/lib/auth/plan-limits';
import { addDomain, removeDomain, checkDomain } from '@/lib/integrations/vercel-domains';
import { createResendDomain, deleteResendDomain, verifyResendDomain, getResendDomain } from '@/lib/integrations/resend-domains';
import { invalidateDomainCache } from '@/lib/utils/domain-lookup';
import { logApiError } from '@/lib/api/errors';
import * as settingsRepo from '@/server/repositories/settings.repo';

const DOMAIN_REGEX = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
export function isValidDomain(domain: string): boolean {
  return DOMAIN_REGEX.test(domain) && domain.length <= 253;
}

export function cleanDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
}

// ----- Team domain -----
export async function getTeamDomain(userId: string) {
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    logApiError('team-domain/get', teamError, { userId });
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { data: domainRow, error: domainError } = await settingsRepo.getTeamDomain(team.id);
  if (domainError && domainError.code !== 'PGRST116') {
    logApiError('team-domain/get', domainError, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  return { success: true, domain: domainRow || null };
}

export async function setTeamDomain(userId: string, domain: string) {
  const plan = await getUserPlan(userId);
  if (plan === 'free') {
    return { success: false, error: 'forbidden' as const, message: 'Custom domains require a Pro or Unlimited plan' };
  }
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const existing = await settingsRepo.getTeamDomainByDomain(domain);
  if (existing && existing.team_id !== team.id) {
    return { success: false, error: 'conflict' as const, message: 'This domain is already in use by another team' };
  }
  const vercelResult = await addDomain(domain);
  if (vercelResult.error) {
    return { success: false, error: 'validation' as const, message: `Failed to add domain to Vercel: ${vercelResult.error.message}` };
  }
  const dnsConfig = {
    type: 'CNAME',
    name: domain,
    value: 'cname.vercel-dns.com',
    verification: vercelResult.verification || [],
  };
  const { data: domainRow, error: upsertError } = await settingsRepo.upsertTeamDomain({
    teamId: team.id,
    domain,
    vercelDomainId: vercelResult.name || domain,
    status: vercelResult.verified ? 'active' : 'pending_dns',
    dnsConfig,
  });
  if (upsertError) {
    logApiError('team-domain/post', upsertError, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  await settingsRepo.setTeamWhitelabelEnabled(team.id, true);
  invalidateDomainCache(domain);
  return {
    success: true,
    domain: domainRow,
    dnsInstructions: {
      type: 'CNAME',
      name: domain,
      value: 'cname.vercel-dns.com',
      note: 'Add this CNAME record in your domain DNS settings. Verification may take a few minutes.',
      verification: vercelResult.verification || [],
    },
  };
}

export async function deleteTeamDomain(userId: string) {
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { data: domainRow, error: domainError } = await settingsRepo.getTeamDomainForDelete(team.id);
  if (domainError || !domainRow) {
    return { success: false, error: 'not_found' as const, message: 'Domain not found' };
  }
  const removeResult = await removeDomain(domainRow.domain);
  if (!removeResult.success) {
    return { success: false, error: 'validation' as const, message: 'Failed to remove domain from Vercel. Please try again or contact support.' };
  }
  const { error: deleteError } = await settingsRepo.deleteTeamDomain(domainRow.id);
  if (deleteError) {
    logApiError('team-domain/delete', deleteError, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  invalidateDomainCache(domainRow.domain);
  return { success: true };
}

export async function verifyTeamDomain(userId: string) {
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { data: domainRow, error: domainError } = await settingsRepo.getTeamDomainForDelete(team.id);
  if (domainError || !domainRow) {
    return { success: false, error: 'not_found' as const, message: 'Domain not found' };
  }
  const vercelResult = await checkDomain(domainRow.domain);
  if (vercelResult.error) {
    logApiError('team-domain/verify/vercel', vercelResult.error, { domain: domainRow.domain, teamId: team.id });
    return { success: false, error: 'validation' as const, message: `Failed to check domain: ${vercelResult.error.message}` };
  }
  const isVerified = vercelResult.verified === true;
  const newStatus = isVerified ? 'active' : 'pending_dns';
  const dnsConfig = {
    type: 'CNAME',
    name: domainRow.domain,
    value: 'cname.vercel-dns.com',
    verification: vercelResult.verification || [],
  };
  const { error: updateError } = await settingsRepo.updateTeamDomainStatus(domainRow.id, newStatus, dnsConfig);
  if (updateError) {
    logApiError('team-domain/verify/update', updateError, { domainId: domainRow.id, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  if (isVerified) invalidateDomainCache(domainRow.domain);
  return {
    success: true,
    status: newStatus,
    verified: isVerified,
    verification: vercelResult.verification || [],
  };
}

// ----- Team email domain -----
export async function getTeamEmailDomain(userId: string) {
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { data: domainRow, error: domainError } = await settingsRepo.getTeamEmailDomain(team.id);
  if (domainError && domainError.code !== 'PGRST116') {
    logApiError('team-email-domain/get', domainError, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  return { success: true, emailDomain: domainRow || null };
}

export async function setTeamEmailDomain(userId: string, domain: string) {
  const plan = await getUserPlan(userId);
  if (plan === 'free') {
    return { success: false, error: 'forbidden' as const, message: 'Custom email domains require a Pro or Unlimited plan' };
  }
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const existing = await settingsRepo.getTeamEmailDomainByDomain(domain);
  if (existing && existing.team_id !== team.id) {
    return { success: false, error: 'conflict' as const, message: 'This email domain is already in use by another team' };
  }
  const result = await createResendDomain(domain);
  if (result.error) {
    return { success: false, error: 'validation' as const, message: `Failed to add domain to Resend: ${result.error.message}` };
  }
  const { data: domainRow, error: upsertError } = await settingsRepo.upsertTeamEmailDomain({
    teamId: team.id,
    domain,
    resendDomainId: result.id,
    status: 'pending',
    dnsRecords: result.records,
    region: result.region || 'us-east-1',
  });
  if (upsertError) {
    logApiError('team-email-domain/post', upsertError, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  return { success: true, emailDomain: domainRow, dnsRecords: result.records };
}

export async function deleteTeamEmailDomain(userId: string) {
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { data: domainRow, error: domainError } = await settingsRepo.getTeamEmailDomainForDelete(team.id);
  if (domainError || !domainRow) {
    return { success: false, error: 'not_found' as const, message: 'Email domain not found' };
  }
  if (domainRow.resend_domain_id) {
    const deleteResult = await deleteResendDomain(domainRow.resend_domain_id);
    if (deleteResult.error) {
      logApiError('team-email-domain/delete/resend', new Error(deleteResult.error.message), { resendDomainId: domainRow.resend_domain_id, teamId: team.id });
      return { success: false, error: 'validation' as const, message: `Failed to remove domain from email provider: ${deleteResult.error.message}` };
    }
  }
  const { error: deleteError } = await settingsRepo.deleteTeamEmailDomain(domainRow.id);
  if (deleteError) {
    logApiError('team-email-domain/delete', deleteError, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  await settingsRepo.setTeamCustomFromEmail(team.id, null);
  return { success: true };
}

export async function verifyTeamEmailDomain(userId: string) {
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { data: domainRow, error: domainError } = await settingsRepo.getTeamEmailDomainForVerify(team.id);
  if (domainError || !domainRow) {
    return { success: false, error: 'not_found' as const, message: 'Email domain not found' };
  }
  if (!domainRow.resend_domain_id) {
    return { success: false, error: 'validation' as const, message: 'Email domain is missing its Resend reference. Please remove and re-add the domain.' };
  }
  const verifyResult = await verifyResendDomain(domainRow.resend_domain_id);
  if (verifyResult.error) {
    logApiError('team-email-domain/verify/resend', verifyResult.error, { resendDomainId: domainRow.resend_domain_id, teamId: team.id });
    return { success: false, error: 'validation' as const, message: `Failed to verify domain: ${verifyResult.error.message}` };
  }
  const result = await getResendDomain(domainRow.resend_domain_id);
  if (result.error) {
    logApiError('team-email-domain/verify/get-status', result.error, { resendDomainId: domainRow.resend_domain_id, teamId: team.id });
    return { success: false, error: 'validation' as const, message: `Failed to check domain status: ${result.error.message}` };
  }
  const isVerified = result.status === 'verified';
  const newStatus = isVerified ? 'verified' : 'pending';
  const { error: updateError } = await settingsRepo.updateTeamEmailDomainStatus(domainRow.id, newStatus, result.records);
  if (updateError) {
    logApiError('team-email-domain/verify/update', updateError, { domainId: domainRow.id, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  return { success: true, status: newStatus, verified: isVerified, records: result.records };
}

export async function setTeamFromEmail(userId: string, fromEmail: string) {
  const plan = await getUserPlan(userId);
  if (plan === 'free') {
    return { success: false, error: 'forbidden' as const, message: 'Custom email domains require a Pro or Unlimited plan' };
  }
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { data: emailDomain, error: domainError } = await settingsRepo.getVerifiedTeamEmailDomain(team.id);
  if (domainError && domainError.code !== 'PGRST116') {
    logApiError('team-email-domain/from-email', domainError, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  if (!emailDomain) {
    return { success: false, error: 'validation' as const, message: 'You must have a verified email domain first' };
  }
  const expectedSuffix = `@${emailDomain.domain}`;
  if (!fromEmail.toLowerCase().endsWith(expectedSuffix.toLowerCase())) {
    return { success: false, error: 'validation' as const, message: `Email must use your verified domain (${emailDomain.domain})` };
  }
  const { error } = await settingsRepo.setTeamCustomFromEmail(team.id, fromEmail);
  if (error) {
    logApiError('team-email-domain/from-email', error, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

// ----- Whitelabel -----
export async function getWhitelabel(userId: string) {
  const { data: team, error } = await settingsRepo.getTeamWhitelabel(userId);
  if (error) {
    logApiError('whitelabel/get', error, { userId });
    return { success: false, error: 'database' as const };
  }
  return { success: true, whitelabel: team };
}

export async function updateWhitelabel(
  userId: string,
  payload: { hideBranding?: boolean; customFaviconUrl?: string | null; customSiteName?: string | null; customEmailSenderName?: string | null }
) {
  const plan = await getUserPlan(userId);
  if (plan === 'free') {
    return { success: false, error: 'forbidden' as const, message: 'White-label settings require a Pro or Unlimited plan' };
  }
  const { data: team, error: teamError } = await settingsRepo.getTeamByOwnerId(userId);
  if (teamError || !team) {
    return { success: false, error: 'not_found' as const, message: 'Team not found' };
  }
  const { error } = await settingsRepo.updateTeamWhitelabel(team.id, {
    hide_branding: payload.hideBranding,
    custom_favicon_url: payload.customFaviconUrl,
    custom_site_name: payload.customSiteName,
    custom_email_sender_name: payload.customEmailSenderName,
  });
  if (error) {
    logApiError('whitelabel/patch', error, { userId, teamId: team.id });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

// ----- Custom domain (funnel pages) -----
export async function listCustomDomains(userId: string) {
  const { data, error } = await settingsRepo.listFunnelPagesWithCustomDomain(userId);
  if (error) {
    logApiError('custom-domain/list', error, { userId });
    return { success: false, error: 'database' as const };
  }
  const domains = data.map((fp) => ({
    funnelPageId: fp.id,
    slug: fp.slug,
    domain: fp.custom_domain,
    isPublished: fp.is_published,
    targetType: fp.target_type,
    dnsVerified: null as boolean | null,
  }));
  return { success: true, domains };
}

export async function setCustomDomain(userId: string, funnelPageId: string, domain: string) {
  const plan = await getUserPlan(userId);
  if (plan === 'free') {
    return { success: false, error: 'forbidden' as const, message: 'Custom domains require a Pro or Unlimited plan' };
  }
  const { data: funnelPage, error: fpError } = await settingsRepo.getFunnelPageForUser(funnelPageId, userId);
  if (fpError || !funnelPage) {
    return { success: false, error: 'not_found' as const, message: 'Funnel page not found' };
  }
  const existingId = await settingsRepo.getFunnelPageIdByCustomDomain(domain, funnelPageId);
  if (existingId) {
    return { success: false, error: 'conflict' as const, message: 'This domain is already in use by another funnel page' };
  }
  const { error } = await settingsRepo.setFunnelPageCustomDomain(funnelPageId, domain);
  if (error) {
    logApiError('custom-domain/set', error, { userId, funnelPageId });
    return { success: false, error: 'database' as const };
  }
  return {
    success: true,
    domain,
    funnelPageId,
    dnsInstructions: {
      type: 'CNAME',
      name: domain,
      value: 'cname.vercel-dns.com',
      note: 'Add this CNAME record in your domain DNS settings. Then add the domain in Vercel project settings > Domains.',
    },
  };
}

export async function removeCustomDomain(userId: string, funnelPageId: string) {
  const { data: funnelPage, error: fpError } = await settingsRepo.getFunnelPageForUser(funnelPageId, userId);
  if (fpError || !funnelPage) {
    return { success: false, error: 'not_found' as const, message: 'Funnel page not found' };
  }
  const { error } = await settingsRepo.setFunnelPageCustomDomain(funnelPageId, null);
  if (error) {
    logApiError('custom-domain/remove', error, { userId, funnelPageId });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}
