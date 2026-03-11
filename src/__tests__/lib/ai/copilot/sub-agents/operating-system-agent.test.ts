/**
 * @jest-environment node
 */

import { buildOperatingSystemAgentPrompt } from '@/lib/ai/copilot/sub-agents/operating-system-agent';

describe('buildOperatingSystemAgentPrompt', () => {
  const baseSops = [
    {
      title: 'SOP 6.1: Weekly Review Ritual',
      content: 'Every Friday, review pipeline...',
      quality_bars: [],
    },
    {
      title: 'SOP 6.2: Daily Standup',
      content: 'Start each day with 15-min review...',
      quality_bars: [],
    },
  ];

  const baseContext = {
    intake_data: {
      business_description: 'B2B consulting firm',
      target_audience: 'VP Sales at mid-market',
      revenue_range: '5k_10k' as const,
      linkedin_frequency: 'weekly' as const,
      channels_of_interest: ['LinkedIn', 'Cold Email'],
      primary_goal: 'Systematize outreach',
    },
    coaching_mode: 'guide_me' as const,
  };

  it('includes identity section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Operating System specialist');
    expect(prompt).toContain('GTM Accelerator');
  });

  it('includes do_it coaching mode', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'do_it',
    });
    expect(prompt).toContain('Mode: Do It For Me');
  });

  it('includes guide_me coaching mode', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Mode: Guide Me');
  });

  it('includes teach_me coaching mode', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'teach_me',
    });
    expect(prompt).toContain('Mode: Teach Me');
    expect(prompt).toContain('compound');
  });

  it('includes daily rhythm section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Daily Rhythm');
    expect(prompt).toContain('morning');
  });

  it('includes weekly review section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Weekly Review');
    expect(prompt).toContain('pipeline');
  });

  it('includes pipeline review cadence section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Pipeline Review');
    expect(prompt).toContain('stage');
  });

  it('includes metrics dashboard section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Metrics Dashboard');
    expect(prompt).toContain('KPI');
  });

  it('includes user context when intake data present', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('B2B consulting firm');
    expect(prompt).toContain('VP Sales at mid-market');
  });

  it('omits user context section when no intake data', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, {
      ...baseContext,
      intake_data: null,
    });
    expect(prompt).not.toContain('User Context');
  });

  it('includes SOPs when provided', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('SOP 6.1: Weekly Review Ritual');
    expect(prompt).toContain('Every Friday, review pipeline');
  });

  it('handles empty SOPs', () => {
    const prompt = buildOperatingSystemAgentPrompt([], baseContext);
    expect(prompt).not.toContain('Module SOPs');
  });

  it('includes output protocol with correct module and deliverable types', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('"module_id": "m6"');
    expect(prompt).toContain('"weekly_ritual"');
    expect(prompt).toContain('"operating_playbook"');
  });
});
