/**
 * @jest-environment node
 */
import {
  submitSignalSchema,
  createPlaySchema,
  updatePlaySchema,
  playFeedbackSchema,
  scrapeConfigSchema,
  updateSignalSchema,
} from '@/lib/validations/creative-strategy';

describe('submitSignalSchema', () => {
  it('accepts valid signal with URL', () => {
    const result = submitSignalSchema.safeParse({
      linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
      content: 'Great post about sales',
      author_name: 'John Doe',
    });
    expect(result.success).toBe(true);
  });

  it('requires content', () => {
    const result = submitSignalSchema.safeParse({
      author_name: 'John',
    });
    expect(result.success).toBe(false);
  });

  it('requires author_name', () => {
    const result = submitSignalSchema.safeParse({
      content: 'Some content',
    });
    expect(result.success).toBe(false);
  });

  it('validates linkedin_url format', () => {
    const result = submitSignalSchema.safeParse({
      content: 'Content',
      author_name: 'John',
      linkedin_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = submitSignalSchema.safeParse({
      content: 'Content',
      author_name: 'John',
      linkedin_url: 'https://linkedin.com/post/123',
      media_urls: ['https://example.com/image.png'],
      niche: 'B2B SaaS',
      notes: 'Interesting format',
    });
    expect(result.success).toBe(true);
  });
});

describe('createPlaySchema', () => {
  const validPlay = {
    title: 'Tweet Screenshot Exploit',
    thesis: 'LinkedIn algorithm boosts posts with tweet screenshots',
    exploit_type: 'media_format' as const,
    format_instructions: 'Use a screenshot of a tweet related to the post topic',
    signal_ids: ['550e8400-e29b-41d4-a716-446655440000'],
  };

  it('accepts valid play', () => {
    const result = createPlaySchema.safeParse(validPlay);
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, title: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid exploit_type', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, exploit_type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('requires at least one signal_id', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, signal_ids: [] });
    expect(result.success).toBe(false);
  });

  it('validates signal_ids are UUIDs', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, signal_ids: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });

  it('accepts optional niches', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, niches: ['B2B SaaS', 'Agency'] });
    expect(result.success).toBe(true);
  });
});

describe('updatePlaySchema', () => {
  it('accepts partial update', () => {
    const result = updatePlaySchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updatePlaySchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid visibility', () => {
    const result = updatePlaySchema.safeParse({ visibility: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid fields', () => {
    const result = updatePlaySchema.safeParse({
      title: 'Updated',
      thesis: 'New thesis',
      status: 'proven',
      visibility: 'public',
      format_instructions: 'New instructions',
      niches: ['Agency'],
    });
    expect(result.success).toBe(true);
  });
});

describe('playFeedbackSchema', () => {
  it('accepts up rating', () => {
    const result = playFeedbackSchema.safeParse({ rating: 'up' });
    expect(result.success).toBe(true);
  });

  it('accepts down rating with note', () => {
    const result = playFeedbackSchema.safeParse({
      rating: 'down',
      note: 'Did not work for my niche',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid rating', () => {
    const result = playFeedbackSchema.safeParse({ rating: 'maybe' });
    expect(result.success).toBe(false);
  });

  it('rejects note over 500 chars', () => {
    const result = playFeedbackSchema.safeParse({ rating: 'up', note: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe('scrapeConfigSchema', () => {
  it('accepts valid config', () => {
    const result = scrapeConfigSchema.safeParse({
      config_type: 'watchlist',
      outlier_threshold_multiplier: 5.0,
      min_reactions: 500,
      min_comments: 50,
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects multiplier below 1', () => {
    const result = scrapeConfigSchema.safeParse({
      config_type: 'own_account',
      outlier_threshold_multiplier: 0.5,
      min_reactions: 0,
      min_comments: 0,
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative reactions', () => {
    const result = scrapeConfigSchema.safeParse({
      config_type: 'watchlist',
      outlier_threshold_multiplier: 5,
      min_reactions: -1,
      min_comments: 0,
      active: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateSignalSchema', () => {
  it('accepts dismiss action', () => {
    const result = updateSignalSchema.safeParse({ status: 'dismissed' });
    expect(result.success).toBe(true);
  });

  it('accepts reviewed action', () => {
    const result = updateSignalSchema.safeParse({ status: 'reviewed' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateSignalSchema.safeParse({ status: 'approved' });
    expect(result.success).toBe(false);
  });
});
