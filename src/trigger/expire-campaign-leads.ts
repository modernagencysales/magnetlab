/** Expire Campaign Leads. Marks old unconnected leads as expired.
 *  Runs every 6 hours. Joins post_campaigns to use per-campaign lead_expiry_days.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Statuses eligible for expiry — only leads that haven't progressed past connection. */
const EXPIRABLE_STATUSES = ['detected', 'connection_pending'] as const;

// ─── Task ───────────────────────────────────────────────────────────────────

export const expireCampaignLeads = schedules.task({
  id: 'expire-campaign-leads',
  cron: '0 */6 * * *', // Every 6 hours
  maxDuration: 60,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Get active campaigns with their per-campaign expiry setting
    const { data: campaigns, error: campaignError } = await supabase
      .from('post_campaigns')
      .select('id, lead_expiry_days')
      .eq('status', 'active');

    if (campaignError) {
      logger.error('Failed to fetch active campaigns', { error: campaignError.message });
      return { expired: 0, error: campaignError.message };
    }

    if (!campaigns || campaigns.length === 0) {
      logger.info('No active campaigns — nothing to expire');
      return { expired: 0 };
    }

    let totalExpired = 0;
    const now = new Date();

    for (const campaign of campaigns) {
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() - campaign.lead_expiry_days);

      const { count, error } = await supabase
        .from('post_campaign_leads')
        .update({ status: 'expired', expired_at: now.toISOString() }, { count: 'exact' })
        .eq('campaign_id', campaign.id)
        .in('status', [...EXPIRABLE_STATUSES])
        .lt('detected_at', expiryDate.toISOString());

      if (error) {
        logger.error('Failed to expire leads for campaign', {
          campaignId: campaign.id,
          error: error.message,
        });
        continue;
      }

      if (count && count > 0) {
        logger.info('Expired leads for campaign', {
          campaignId: campaign.id,
          count,
          expiryDays: campaign.lead_expiry_days,
        });
        totalExpired += count;
      }
    }

    logger.info('Expire campaign leads complete', { total: totalExpired });
    return { expired: totalExpired };
  },
});
