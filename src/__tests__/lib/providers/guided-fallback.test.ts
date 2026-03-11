/**
 * @jest-environment node
 */
import { GuidedFallbackProvider } from '@/lib/providers/guided-fallback';

describe('GuidedFallbackProvider', () => {
  const provider = new GuidedFallbackProvider();

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('guided');
    expect(provider.name).toBe('Guided Setup');
  });

  it('returns setup steps for dm_outreach', () => {
    const steps = provider.getSetupSteps('dm_outreach');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].title).toBeDefined();
  });

  it('returns setup steps for email_outreach', () => {
    const steps = provider.getSetupSteps('email_outreach');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('returns setup steps for domain', () => {
    const steps = provider.getSetupSteps('domain');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('returns verification checklist for email_outreach', () => {
    const checklist = provider.getVerificationChecklist('email_outreach');
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist[0].item).toBeDefined();
    expect(checklist[0].required).toBeDefined();
  });
});
