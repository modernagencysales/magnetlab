/** Lead Magnet Post Launcher. Orchestrates: publish to LinkedIn -> create campaign -> auto-setup -> activate.
 *  Never imports NextRequest/NextResponse. Depends on team-integrations, unipile, post-campaigns services. */

import {
  getTeamProfileUnipileAccountId,
  getTeamProfilesWithConnections,
} from '@/lib/services/team-integrations';
import { getUnipileClient, isUnipileConfigured } from '@/lib/integrations/unipile';
import { createCampaign, activateCampaign } from '@/server/services/post-campaigns.service';
import { analyzePostForCampaign } from '@/lib/ai/post-campaign/auto-setup';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LaunchInput {
  userId: string;
  teamId: string;
  teamProfileId: string;
  postText: string;
  funnelPageId?: string;
  /** Override AI-generated keywords */
  keywords?: string[];
  /** Override AI-generated DM template */
  dmTemplate?: string;
  /** Campaign name override (default: auto-generated) */
  campaignName?: string;
}

export interface LaunchResult {
  linkedinPostUrl: string;
  linkedinPostId: string;
  campaignId: string;
  campaignName: string;
  status: 'active' | 'draft';
  keywords: string[];
  funnelPageId: string | null;
}

// ─── Publish Only ───────────────────────────────────────────────────────────

export interface PublishOnlyResult {
  linkedinPostUrl: string;
  linkedinPostId: string;
}

/**
 * Publish a post to LinkedIn given a resolved Unipile account ID.
 * Shared by both publishLinkedInPost and launchLeadMagnetPost.
 */
async function publishToLinkedIn(
  unipileAccountId: string,
  postText: string
): Promise<PublishOnlyResult> {
  if (!isUnipileConfigured()) {
    throw Object.assign(new Error('Unipile is not configured'), { statusCode: 500 });
  }

  const client = getUnipileClient();
  const publishResult = await client.createPost(unipileAccountId, postText);

  if (publishResult.error || !publishResult.data) {
    throw Object.assign(
      new Error(`Failed to publish to LinkedIn: ${publishResult.error || 'unknown error'}`),
      { statusCode: 502 }
    );
  }

  const linkedinPostId = publishResult.data.social_id || publishResult.data.id;
  const linkedinPostUrl = `https://www.linkedin.com/feed/update/${linkedinPostId}`;

  return { linkedinPostUrl, linkedinPostId };
}

/**
 * Publish a post to LinkedIn via a team profile's Unipile account.
 * Returns the LinkedIn post URL and ID. Does not create a campaign.
 */
export async function publishLinkedInPost(
  teamProfileId: string,
  postText: string
): Promise<PublishOnlyResult> {
  const unipileAccountId = await getTeamProfileUnipileAccountId(teamProfileId);
  if (!unipileAccountId) {
    throw Object.assign(new Error('LinkedIn account not connected for this team profile'), {
      statusCode: 400,
    });
  }

  return publishToLinkedIn(unipileAccountId, postText);
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

/**
 * Full launch flow: publish post to LinkedIn, run AI auto-setup, create campaign, activate.
 *
 * Steps:
 * 1. Resolve Unipile account for the team profile
 * 2. Publish post to LinkedIn via Unipile
 * 3. Resolve funnel info for AI context (if funnelPageId provided)
 * 4. Run AI auto-setup for keywords/templates (unless overrides provided)
 * 5. Create post campaign with the resolved config
 * 6. Activate the campaign immediately
 */
export async function launchLeadMagnetPost(input: LaunchInput): Promise<LaunchResult> {
  const {
    userId,
    teamId,
    teamProfileId,
    postText,
    funnelPageId,
    keywords: overrideKeywords,
    dmTemplate: overrideDmTemplate,
    campaignName: overrideName,
  } = input;

  // 1. Resolve Unipile account for this team profile
  const unipileAccountId = await getTeamProfileUnipileAccountId(teamProfileId);
  if (!unipileAccountId) {
    throw Object.assign(new Error('LinkedIn account not connected for this team profile'), {
      statusCode: 400,
    });
  }

  // 2. Publish to LinkedIn
  const { linkedinPostUrl, linkedinPostId } = await publishToLinkedIn(unipileAccountId, postText);

  // 3. Resolve funnel info for AI context
  let publishedFunnels: Array<{
    id: string;
    title: string;
    slug: string;
    leadMagnetTitle: string;
  }> = [];
  if (funnelPageId) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data: funnel } = await supabase
        .from('funnel_pages')
        .select('id, slug, optin_headline, lead_magnets(title)')
        .eq('id', funnelPageId)
        .single();

      if (funnel) {
        publishedFunnels = [
          {
            id: funnel.id as string,
            title: (funnel.optin_headline as string) || '',
            slug: (funnel.slug as string) || '',
            leadMagnetTitle: (funnel.lead_magnets as { title: string } | null)?.title || '',
          },
        ];
      }
    } catch (err) {
      // Funnel lookup failure should not block the launch
      logError('lead-magnet-post-launcher', err, { step: 'funnel-lookup', funnelPageId });
    }
  }

  // 4. AI auto-setup (keywords, DM template, reply template)
  let keywords = overrideKeywords || [];
  let dmTemplate = overrideDmTemplate || '';
  let replyTemplate = '';
  let resolvedFunnelPageId = funnelPageId || null;

  if (!overrideKeywords || !overrideDmTemplate) {
    try {
      // Fetch real team profiles for AI context
      const profiles = await getTeamProfilesWithConnections(teamId);
      const teamProfilesForAi = profiles
        .filter((p) => p.linkedin_connected && p.unipile_account_id)
        .map((p) => ({
          id: p.id,
          name: p.full_name || '',
          unipileAccountId: p.unipile_account_id!,
        }));

      const aiResult = await analyzePostForCampaign({
        postText,
        publishedFunnels,
        teamProfiles: teamProfilesForAi,
        posterProfileId: teamProfileId,
      });
      // AutoSetupResult.keyword is singular string — convert to array
      if (!overrideKeywords) keywords = aiResult.keyword ? [aiResult.keyword] : [];
      if (!overrideDmTemplate) dmTemplate = aiResult.dmTemplate || '';
      replyTemplate = aiResult.replyTemplate || '';
      if (!resolvedFunnelPageId && aiResult.funnelPageId) {
        resolvedFunnelPageId = aiResult.funnelPageId;
      }
    } catch (err) {
      // AI failure should not block the launch — use sensible defaults
      logError('lead-magnet-post-launcher', err, { step: 'auto-setup' });
      if (!keywords.length) keywords = ['guide', 'interested', 'send'];
      if (!dmTemplate)
        dmTemplate = 'Hey {{name}}, thanks for your interest! Here you go: {{funnel_url}}';
    }
  }

  // 5. Create post campaign
  const name = overrideName || `Lead Magnet Post — ${new Date().toISOString().slice(0, 10)}`;

  const campaignResult = await createCampaign(userId, teamId, {
    name,
    post_url: linkedinPostUrl,
    keywords,
    unipile_account_id: unipileAccountId,
    dm_template: dmTemplate,
    reply_template: replyTemplate,
    funnel_page_id: resolvedFunnelPageId || undefined,
    auto_accept_connections: true,
    auto_like_comments: true,
    auto_connect_non_requesters: true,
  });

  if (!campaignResult.success) {
    throw Object.assign(
      new Error(`Failed to create campaign: ${campaignResult.message || 'unknown'}`),
      { statusCode: 500 }
    );
  }

  const campaignId = campaignResult.data.id;

  // 6. Activate immediately
  let status: 'active' | 'draft' = 'draft';
  const activateResult = await activateCampaign(userId, campaignId);
  if (!activateResult.success) {
    // Campaign was created but not activated — log but don't fail
    logError('lead-magnet-post-launcher', new Error('Failed to activate campaign'), {
      campaignId,
      error: activateResult.message,
    });
  } else {
    status = 'active';
  }

  return {
    linkedinPostUrl,
    linkedinPostId,
    campaignId,
    campaignName: name,
    status,
    keywords,
    funnelPageId: resolvedFunnelPageId,
  };
}

// ─── Error Helper ───────────────────────────────────────────────────────────

/** Extract statusCode from a service error, defaulting to 500. */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
