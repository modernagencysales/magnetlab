/**
 * @jest-environment node
 */
import { buildTamAgentPrompt } from '@/lib/ai/copilot/sub-agents/tam-agent';

describe('buildTamAgentPrompt', () => {
  const baseSops = [
    { title: 'Export Connections', content: 'Export your LinkedIn...', quality_bars: [] },
  ];
  const baseCtx = {
    intake_data: {
      business_description: 'B2B Agency',
      target_audience: 'Marketing Directors',
    } as Record<string, unknown>,
    coaching_mode: 'guide_me' as const,
  };

  it('includes TAM Builder identity', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('TAM Builder specialist');
  });

  it('includes enrichment waterfall steps', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('LeadMagic');
    expect(prompt).toContain('Prospeo');
    expect(prompt).toContain('BlitzAPI');
  });

  it('includes segmentation rules', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('Warm + LinkedIn Active');
    expect(prompt).toContain('Cold + Email Only');
  });

  it('adapts to do_it coaching mode', () => {
    const prompt = buildTamAgentPrompt(baseSops, { ...baseCtx, coaching_mode: 'do_it' });
    expect(prompt).toContain('Do It For Me');
  });

  it('adapts to teach_me coaching mode', () => {
    const prompt = buildTamAgentPrompt(baseSops, { ...baseCtx, coaching_mode: 'teach_me' });
    expect(prompt).toContain('Teach Me');
  });

  it('includes user context from intake', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('B2B Agency');
    expect(prompt).toContain('Marketing Directors');
  });

  it('includes output protocol with handoff JSON', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('tam_list');
    expect(prompt).toContain('handoff JSON');
  });
});
