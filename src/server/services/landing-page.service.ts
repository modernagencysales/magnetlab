/**
 * Landing Page Quick-Create Service
 * Creates stub lead magnet, AI-generated opt-in copy, and funnel page. Uses repos only.
 */

import { getDataScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';
import { generateOptinContent } from '@/lib/ai/funnel-content-generator';
import * as leadMagnetsRepo from '@/server/repositories/lead-magnets.repo';
import * as funnelsRepo from '@/server/repositories/funnels.repo';
import { logApiError } from '@/lib/api/errors';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

async function getNextAvailableSlug(scope: DataScope, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 0;
  while (await funnelsRepo.checkSlugCollision(scope, slug)) {
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

export async function quickCreate(userId: string, title: string, description?: string) {
  const scope = await getDataScope(userId);
  const teamId = scope.teamId ?? null;

  const leadMagnet = await leadMagnetsRepo.createLeadMagnetSelect(
    userId,
    teamId,
    {
      title: title.trim(),
      archetype: 'focused-toolkit',
      status: 'draft',
      concept: {
        title: title.trim(),
        painSolved: description || '',
        deliveryFormat: 'Landing Page',
        isQuickCreate: true,
      },
    },
    'id, title'
  );

  let optinContent: { headline: string; subline: string; socialProof: string; buttonText: string };
  try {
    optinContent = await generateOptinContent({
      leadMagnetTitle: title.trim(),
      concept: null,
      extractedContent: null,
      credibility: description || undefined,
    });
  } catch (aiError) {
    logApiError('landing-page/quick-create/ai-generate', aiError, { userId });
    optinContent = {
      headline: title.trim(),
      subline: description || 'Get instant access to proven strategies',
      socialProof: 'Join thousands of professionals using this resource',
      buttonText: 'Get Free Access',
    };
  }

  const baseSlug = generateSlug(title.trim());
  const slug = await getNextAvailableSlug(scope, baseSlug);

  const funnelRow = {
    lead_magnet_id: leadMagnet.id,
    user_id: userId,
    team_id: teamId,
    slug,
    optin_headline: optinContent.headline,
    optin_subline: optinContent.subline,
    optin_button_text: optinContent.buttonText,
    optin_social_proof: optinContent.socialProof,
    thankyou_headline: 'Thanks! Check your email.',
    thankyou_subline: 'Your download is on its way.',
    qualification_pass_message: 'Great! Book a call below.',
    qualification_fail_message: 'Thanks for your interest!',
    theme: 'dark',
    primary_color: '#8b5cf6',
    background_style: 'solid',
  };

  try {
    const funnelPage = await funnelsRepo.createFunnel(funnelRow);
    return {
      success: true,
      leadMagnetId: leadMagnet.id,
      funnelPageId: funnelPage.id,
    };
  } catch (err) {
    await leadMagnetsRepo.deleteLeadMagnetById(leadMagnet.id);
    throw err;
  }
}
