/**
 * @jest-environment node
 */
import { buildOutreachAgentPrompt } from '@/lib/ai/copilot/sub-agents/outreach-agent';

describe('buildOutreachAgentPrompt', () => {
  const baseSops = [
    { title: 'HeyReach Connection', content: 'Set up HeyReach...', quality_bars: [] },
  ];
  const baseCtx = {
    intake_data: { business_description: 'B2B SaaS', target_audience: 'CTOs' } as Record<
      string,
      unknown
    >,
    coaching_mode: 'guide_me' as const,
  };

  it('includes outreach identity', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('Outreach Setup specialist');
  });

  it('includes LinkedIn-specific rules for linkedin focus', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('DM');
    expect(prompt).toContain('connection request');
  });

  it('includes cold email rules for email focus', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'email');
    expect(prompt).toContain('cold email');
    expect(prompt).toContain('warmup');
  });

  it('includes provider resolution flow', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('check_provider_status');
    expect(prompt).toContain('list_providers');
  });

  it('adapts to do_it coaching mode', () => {
    const prompt = buildOutreachAgentPrompt(
      baseSops,
      { ...baseCtx, coaching_mode: 'do_it' },
      'email'
    );
    expect(prompt).toContain('Do It For Me');
  });

  it('adapts to teach_me coaching mode', () => {
    const prompt = buildOutreachAgentPrompt(
      baseSops,
      { ...baseCtx, coaching_mode: 'teach_me' },
      'email'
    );
    expect(prompt).toContain('Teach Me');
  });

  it('includes user context from intake', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('B2B SaaS');
    expect(prompt).toContain('CTOs');
  });

  it('includes SOPs', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('HeyReach Connection');
  });
});
