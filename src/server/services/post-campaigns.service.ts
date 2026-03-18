/**
 * Post Campaigns Service
 * Business logic for post_campaigns and post_campaign_leads.
 * Never imports from the route layer. Side effects must not block core returns.
 */

import { logError } from '@/lib/utils/logger';
import { normalizePostUrl } from '@/lib/utils/linkedin-url';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getTeamProfilesWithConnections } from '@/lib/services/team-integrations';
import { analyzePostForCampaign } from '@/lib/ai/post-campaign/auto-setup';
import type { AutoSetupResult } from '@/lib/ai/post-campaign/auto-setup';
import type { DataScope } from '@/lib/utils/team-context';
import * as repo from '@/server/repositories/post-campaigns.repo';
import type {
  PostCampaignStatus,
  PostCampaignLeadStatus,
  CreatePostCampaignInput,
  UpdatePostCampaignInput,
  DmTemplateVars,
  PostCampaign,
  PostCampaignLead,
} from '@/lib/types/post-campaigns';
import { LINKEDIN_SAFETY as SAFETY } from '@/lib/types/post-campaigns';

// ─── Result Types ───────────────────────────────────────────────────────────

type ServiceSuccess<T> = { success: true; data: T };
type ServiceError = {
  success: false;
  error: 'validation' | 'not_found' | 'database';
  message?: string;
};
type ServiceResult<T> = ServiceSuccess<T> | ServiceError;

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateCampaignInput(
  input: CreatePostCampaignInput
): ServiceResult<CreatePostCampaignInput> {
  if (!input.name?.trim()) {
    return { success: false, error: 'validation', message: 'Campaign name is required' };
  }
  if (!input.keywords || input.keywords.length === 0) {
    return { success: false, error: 'validation', message: 'At least one keyword is required' };
  }
  if (!input.dm_template?.trim()) {
    return { success: false, error: 'validation', message: 'DM template is required' };
  }
  if (!input.unipile_account_id?.trim()) {
    return { success: false, error: 'validation', message: 'LinkedIn account is required' };
  }

  const normalizedUrl = normalizePostUrl(input.post_url);
  if (!normalizedUrl) {
    return { success: false, error: 'validation', message: 'Invalid LinkedIn post URL' };
  }

  return {
    success: true,
    data: { ...input, post_url: normalizedUrl },
  };
}

// ─── DM Template Rendering ───────────────────────────────────────────────────

/**
 * Replace {{name}} and {{funnel_url}} placeholders in a DM template.
 * Falls back to empty string for missing name.
 */
export function renderDmTemplate(template: string, vars: DmTemplateVars): string {
  return template
    .replace(/\{\{name\}\}/g, vars.name ?? '')
    .replace(/\{\{funnel_url\}\}/g, vars.funnel_url ?? '');
}

// ─── Campaign CRUD ───────────────────────────────────────────────────────────

export async function listCampaigns(
  userId: string,
  status?: PostCampaignStatus
): Promise<ServiceResult<PostCampaign[]>> {
  const { data, error } = await repo.listCampaigns(userId, status);
  if (error) {
    logError('post-campaigns/listCampaigns', error, { userId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: data ?? [] };
}

export async function getCampaign(
  userId: string,
  id: string
): Promise<ServiceResult<PostCampaign & { stats: Record<string, number> }>> {
  const { data, error } = await repo.getCampaign(userId, id);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('post-campaigns/getCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }

  const stats = await repo.getCampaignStats(id);
  return { success: true, data: { ...data, stats } };
}

export async function createCampaign(
  userId: string,
  teamId: string | null,
  input: CreatePostCampaignInput
): Promise<ServiceResult<PostCampaign>> {
  const validation = validateCampaignInput(input);
  if (!validation.success) return validation;

  const { data, error } = await repo.createCampaign(userId, teamId, validation.data);
  if (error) {
    logError('post-campaigns/createCampaign', error, { userId });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'database', message: 'Failed to create campaign' };
  }
  return { success: true, data };
}

export async function updateCampaign(
  userId: string,
  id: string,
  input: UpdatePostCampaignInput
): Promise<ServiceResult<PostCampaign>> {
  const { data, error } = await repo.updateCampaign(userId, id, input);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('post-campaigns/updateCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }
  return { success: true, data };
}

export async function deleteCampaign(
  userId: string,
  id: string
): Promise<ServiceResult<{ id: string }>> {
  const { error } = await repo.deleteCampaign(userId, id);
  if (error) {
    logError('post-campaigns/deleteCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: { id } };
}

export async function activateCampaign(
  userId: string,
  id: string
): Promise<ServiceResult<PostCampaign>> {
  const { data, error } = await repo.updateCampaign(userId, id, { status: 'active' });
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('post-campaigns/activateCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }
  return { success: true, data };
}

export async function pauseCampaign(
  userId: string,
  id: string
): Promise<ServiceResult<PostCampaign>> {
  const { data, error } = await repo.updateCampaign(userId, id, { status: 'paused' });
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('post-campaigns/pauseCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }
  return { success: true, data };
}

// ─── Campaign Leads ──────────────────────────────────────────────────────────

export async function listCampaignLeads(
  userId: string,
  campaignId: string,
  status?: PostCampaignLeadStatus
): Promise<ServiceResult<PostCampaignLead[]>> {
  const { data, error } = await repo.listCampaignLeads(userId, campaignId, status);
  if (error) {
    logError('post-campaigns/listCampaignLeads', error, { userId, campaignId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: data ?? [] };
}

// ─── Test DM Preview ────────────────────────────────────────────────────

export async function sendTestDm(
  userId: string,
  campaignId: string
): Promise<ServiceResult<{ rendered_dm: string; note: string }>> {
  const { data: campaign, error } = await repo.getCampaign(userId, campaignId);
  if (error || !campaign) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }

  let funnelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.magnetlab.app'}/p/your-username/your-lead-magnet`;

  if (campaign.funnel_page_id) {
    try {
      const { createSupabaseAdminClient } = await import('@/lib/utils/supabase-server');
      const supabase = createSupabaseAdminClient();
      const { data: funnelPage } = await supabase
        .from('funnel_pages')
        .select('slug, user_id')
        .eq('id', campaign.funnel_page_id)
        .single();

      if (funnelPage?.slug) {
        const { data: user } = await supabase
          .from('users')
          .select('username')
          .eq('id', funnelPage.user_id)
          .single();

        if (user?.username) {
          funnelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.magnetlab.app'}/p/${user.username}/${funnelPage.slug}`;
        }
      }
    } catch (err) {
      logError('post-campaigns/sendTestDm', err, { campaignId });
    }
  }

  const rendered_dm = renderDmTemplate(campaign.dm_template, {
    name: 'Test User',
    funnel_url: funnelUrl,
  });

  return {
    success: true,
    data: { rendered_dm, note: 'Preview only. No DM was sent.' },
  };
}

// ─── Daily Limits ────────────────────────────────────────────────────────────

/**
 * Check if the given action is within the daily LinkedIn safety limit.
 * Returns true if the action is allowed, false if the limit has been reached.
 */
export async function checkDailyLimit(
  userId: string,
  accountId: string,
  action: 'dms_sent' | 'connections_accepted' | 'connection_requests_sent'
): Promise<boolean> {
  const { data, error } = await repo.getDailyLimit(userId, accountId);
  if (error || !data) return false;

  const limits: Record<string, number> = {
    dms_sent: SAFETY.MAX_DMS_PER_DAY,
    connections_accepted: SAFETY.MAX_ACCEPTS_PER_DAY,
    connection_requests_sent: SAFETY.MAX_CONNECT_REQUESTS_PER_DAY,
  };

  const current = (data as Record<string, number>)[action] ?? 0;
  return current < (limits[action] ?? 0);
}

// ─── Timing Utilities ────────────────────────────────────────────────────────

/** Return a random integer between minMs and maxMs (inclusive). */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/** Resolve after ms milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Auto-Setup ─────────────────────────────────────────────────────────────

/**
 * AI-powered campaign auto-setup. Fetches post text, published funnels,
 * and team profiles with LinkedIn connections, then calls the AI analyzer
 * to generate a draft campaign configuration.
 */
export async function autoSetupCampaign(
  scope: DataScope,
  postId: string
): Promise<AutoSetupResult> {
  const supabase = createSupabaseAdminClient();

  // 1. Fetch post text from cp_pipeline_posts
  const { data: post, error: postError } = await supabase
    .from('cp_pipeline_posts')
    .select('id, final_content, draft_content, team_profile_id')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    throw Object.assign(new Error('Post not found'), { statusCode: 404 });
  }

  const postText = post.final_content || post.draft_content || '';

  // 2. Fetch user's published funnels with lead magnet titles
  const { data: funnels } = await supabase
    .from('funnel_pages')
    .select('id, slug, optin_headline, lead_magnets(title)')
    .eq('user_id', scope.userId)
    .eq('is_published', true);

  const publishedFunnels = (funnels || []).map((f) => ({
    id: f.id as string,
    title: (f.optin_headline as string) || '',
    slug: (f.slug as string) || '',
    leadMagnetTitle: (f.lead_magnets as { title: string } | null)?.title || '',
  }));

  // 3. Fetch team profiles with Unipile connections
  // Use team-integrations service which handles both team_profile_integrations
  // and user_integrations fallback for resolving unipile_account_id.
  let teamProfiles: Array<{ id: string; name: string; unipileAccountId: string }> = [];

  if (scope.type === 'team' && scope.teamId) {
    const profilesWithConnections = await getTeamProfilesWithConnections(scope.teamId);
    teamProfiles = profilesWithConnections
      .filter((p) => p.linkedin_connected && p.unipile_account_id)
      .map((p) => ({
        id: p.id,
        name: p.full_name || '',
        unipileAccountId: p.unipile_account_id!,
      }));
  }

  // 4. Call AI analyzer
  const result = await analyzePostForCampaign({
    postText,
    publishedFunnels,
    teamProfiles,
    posterProfileId: post.team_profile_id || '',
  });

  return result;
}

// ─── Error Helper ───────────────────────────────────────────────────────────

/** Extract statusCode from a service error, defaulting to 500. */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
