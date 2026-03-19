import { updateFunnelSchema } from '@/lib/validations/api';

describe('updateFunnelSchema — conversion fields', () => {
  it('accepts vsl framing and CTA fields', () => {
    const result = updateFunnelSchema.safeParse({
      vslHeadline: 'THE METHOD',
      vslSubline: 'Watch this free training',
      ctaHeadline: 'Ready?',
      ctaButtonText: 'BOOK NOW',
      thankyouLayout: 'video_first',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null values for optional fields', () => {
    const result = updateFunnelSchema.safeParse({
      vslHeadline: null,
      vslSubline: null,
      ctaHeadline: null,
      ctaButtonText: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid thankyouLayout', () => {
    const result = updateFunnelSchema.safeParse({
      thankyouLayout: 'invalid_layout',
    });
    expect(result.success).toBe(false);
  });
});
