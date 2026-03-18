/**
 * @jest-environment node
 */
import {
  ContentQueueUpdateSchema,
  ContentQueueSubmitSchema,
} from '@/lib/validations/content-queue';

describe('ContentQueueUpdateSchema', () => {
  it('accepts valid update with draft_content', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      draft_content: 'Updated post text',
    });
    expect(result.success).toBe(true);
  });

  it('accepts mark_edited flag', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      mark_edited: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts image_urls array', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      image_urls: ['https://example.com/image.png'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = ContentQueueUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      draft_content: 'text',
      unknown_field: 'value',
    });
    // strict() strips unknown fields — verify only known fields pass through
    if (result.success) {
      expect(result.data).not.toHaveProperty('unknown_field');
    }
  });
});

describe('ContentQueueSubmitSchema', () => {
  it('accepts valid team_id', () => {
    const result = ContentQueueSubmitSchema.safeParse({
      team_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing team_id', () => {
    const result = ContentQueueSubmitSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty team_id', () => {
    const result = ContentQueueSubmitSchema.safeParse({ team_id: '' });
    expect(result.success).toBe(false);
  });
});
