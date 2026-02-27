// src/trigger/enrich-and-push-plusvibe.ts
import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { waterfallEmailFind } from '@/lib/integrations/enrichment/waterfall';
import { addLeadsToPlusVibeCampaign } from '@/lib/integrations/plusvibe';
import { getProfile } from '@/lib/integrations/harvest-api';

interface EnrichAndPushPayload {
  userId: string;
  automationId: string;
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  plusvibeCampaignId: string;
  optInUrl?: string;
}

export const enrichAndPushPlusvibe = task({
  id: 'enrich-and-push-plusvibe',
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async (payload: EnrichAndPushPayload) => {
    const {
      userId,
      automationId,
      linkedinUrl,
      firstName,
      lastName,
      plusvibeCampaignId,
      optInUrl,
    } = payload;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    logger.info('Starting enrichment for PlusVibe push', {
      linkedinUrl,
      firstName,
      plusvibeCampaignId,
    });

    // 1. Check dedup — upsert engagement_enrichments record
    const { data: existing } = await supabase
      .from('engagement_enrichments')
      .select('id, status')
      .eq('user_id', userId)
      .eq('automation_id', automationId)
      .eq('linkedin_url', linkedinUrl)
      .maybeSingle();

    if (existing && (existing.status === 'pushed' || existing.status === 'enriching')) {
      logger.info('Already processed or in progress', { status: existing.status });
      return { skipped: true, reason: existing.status };
    }

    // Upsert the record
    const { data: enrichment, error: upsertError } = await supabase
      .from('engagement_enrichments')
      .upsert(
        {
          user_id: userId,
          automation_id: automationId,
          linkedin_url: linkedinUrl,
          first_name: firstName,
          last_name: lastName,
          plusvibe_campaign_id: plusvibeCampaignId,
          status: 'enriching',
        },
        { onConflict: 'user_id,automation_id,linkedin_url' }
      )
      .select('id')
      .single();

    if (upsertError || !enrichment) {
      logger.error('Failed to upsert enrichment record', { error: upsertError?.message });
      return { success: false, error: 'db_upsert_failed' };
    }

    const enrichmentId = enrichment.id;

    // 2. Enrich profile via Harvest API (get company, headline for email finding)
    let company = '';
    let headline = '';
    let companyDomain = '';

    try {
      const profile = await getProfile({ url: linkedinUrl });
      if (profile.data) {
        company = profile.data.company || '';
        headline = profile.data.headline || '';
        // Try to extract company domain from experience
        const experience = profile.data.experience;
        if (Array.isArray(experience) && experience.length > 0) {
          companyDomain = experience[0]?.company_url
            ? new URL(experience[0].company_url).hostname.replace('www.', '')
            : '';
        }
      }
    } catch (err) {
      logger.warn('Harvest profile lookup failed, continuing with name only', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Update enrichment record with profile data
    await supabase
      .from('engagement_enrichments')
      .update({ headline, company })
      .eq('id', enrichmentId);

    // 3. Run email waterfall
    logger.info('Running email waterfall', { firstName, lastName, company, companyDomain });

    const result = await waterfallEmailFind({
      first_name: firstName,
      last_name: lastName,
      company_domain: companyDomain,
      linkedin_url: linkedinUrl,
    });

    logger.info('Waterfall result', {
      email: result.email ? '***found***' : null,
      provider: result.provider,
      validated: result.validated,
      attempts: result.attempts.length,
    });

    if (!result.email) {
      await supabase
        .from('engagement_enrichments')
        .update({ status: 'no_email' })
        .eq('id', enrichmentId);

      return { success: false, reason: 'no_email', attempts: result.attempts };
    }

    if (result.validation_status === 'invalid') {
      await supabase
        .from('engagement_enrichments')
        .update({
          email: result.email,
          email_provider: result.provider,
          email_validation_status: result.validation_status,
          status: 'failed',
        })
        .eq('id', enrichmentId);

      return { success: false, reason: 'email_invalid', email_provider: result.provider };
    }

    // 4. Update enrichment record with email
    await supabase
      .from('engagement_enrichments')
      .update({
        email: result.email,
        email_provider: result.provider,
        email_validation_status: result.validation_status || 'unknown',
        status: 'enriched',
      })
      .eq('id', enrichmentId);

    // 5. Push to PlusVibe
    logger.info('Pushing to PlusVibe campaign', { plusvibeCampaignId });

    const customVariables: Record<string, string> = {};
    if (optInUrl) customVariables.opt_in_url = optInUrl;
    if (company) customVariables.company_name = company;
    customVariables.linkedin_url = linkedinUrl;

    const pushResult = await addLeadsToPlusVibeCampaign(plusvibeCampaignId, [
      {
        email: result.email,
        first_name: firstName,
        last_name: lastName,
        company_name: company || undefined,
        linkedin_person_url: linkedinUrl,
        custom_variables: customVariables,
      },
    ]);

    if (!pushResult.success) {
      await supabase
        .from('engagement_enrichments')
        .update({
          plusvibe_error: pushResult.error,
          status: 'failed',
        })
        .eq('id', enrichmentId);

      logger.error('PlusVibe push failed', { error: pushResult.error });
      return { success: false, reason: 'plusvibe_push_failed', error: pushResult.error };
    }

    // 6. Mark as pushed
    await supabase
      .from('engagement_enrichments')
      .update({
        plusvibe_pushed_at: new Date().toISOString(),
        status: 'pushed',
      })
      .eq('id', enrichmentId);

    logger.info('Successfully enriched and pushed to PlusVibe', {
      email_provider: result.provider,
      plusvibe_campaign: plusvibeCampaignId,
    });

    return {
      success: true,
      email_provider: result.provider,
      validated: result.validated,
    };
  },
});
