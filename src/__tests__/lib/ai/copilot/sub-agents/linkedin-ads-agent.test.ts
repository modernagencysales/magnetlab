/**
 * @jest-environment node
 */

import { buildLinkedInAdsAgentPrompt } from '@/lib/ai/copilot/sub-agents/linkedin-ads-agent';

describe('buildLinkedInAdsAgentPrompt', () => {
  const baseSops = [
    {
      title: 'SOP 5.1: Campaign Strategy',
      content: 'Define campaign objective...',
      quality_bars: [],
    },
    {
      title: 'SOP 5.2: Audience Targeting',
      content: 'Build matched audiences...',
      quality_bars: [],
    },
  ];

  const baseContext = {
    intake_data: {
      business_description: 'B2B SaaS for agencies',
      target_audience: 'Agency owners',
      revenue_range: 'under_5k' as const,
      linkedin_frequency: 'daily' as const,
      channels_of_interest: ['LinkedIn Ads'],
      primary_goal: 'Generate leads via ads',
    },
    coaching_mode: 'guide_me' as const,
  };

  it('includes identity section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('LinkedIn Ads specialist');
    expect(prompt).toContain('GTM Accelerator');
  });

  it('includes do_it coaching mode', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'do_it',
    });
    expect(prompt).toContain('Mode: Do It For Me');
    expect(prompt).toContain('campaign structure');
  });

  it('includes guide_me coaching mode', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Mode: Guide Me');
  });

  it('includes teach_me coaching mode', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'teach_me',
    });
    expect(prompt).toContain('Mode: Teach Me');
    expect(prompt).toContain('auction');
  });

  it('includes campaign strategy section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Campaign Strategy');
    expect(prompt).toContain('Lead Gen Form');
  });

  it('includes audience targeting section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Audience Targeting');
    expect(prompt).toContain('Matched Audiences');
  });

  it('includes budget optimization section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Budget');
    expect(prompt).toContain('$50/day');
  });

  it('includes A/B testing section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('A/B');
    expect(prompt).toContain('creative');
  });

  it('includes user context when intake data present', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('B2B SaaS for agencies');
    expect(prompt).toContain('Agency owners');
  });

  it('omits user context section when no intake data', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, {
      ...baseContext,
      intake_data: null,
    });
    expect(prompt).not.toContain('User Context');
  });

  it('includes SOPs when provided', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('SOP 5.1: Campaign Strategy');
    expect(prompt).toContain('Define campaign objective');
  });

  it('handles empty SOPs', () => {
    const prompt = buildLinkedInAdsAgentPrompt([], baseContext);
    expect(prompt).not.toContain('Module SOPs');
  });

  it('includes output protocol with correct module and deliverable types', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('"module_id": "m5"');
    expect(prompt).toContain('"ad_campaign"');
    expect(prompt).toContain('"ad_targeting"');
  });

  it('includes metric interpretation guidance', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('CTR');
    expect(prompt).toContain('CPL');
    expect(prompt).toContain('ROAS');
  });
});
