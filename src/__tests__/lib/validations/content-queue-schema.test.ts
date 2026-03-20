/**
 * @jest-environment node
 */
/**
 * Content Queue Schema Tests — image_storage_path field.
 * Tests the ContentQueueUpdateSchema after the image upload feature was added.
 * Covers the new image_storage_path (string | null | undefined) and its
 * interaction with the .refine() "at least one field" guard.
 */
import { ContentQueueUpdateSchema } from '@/lib/validations/content-queue';

describe('ContentQueueUpdateSchema — image_storage_path', () => {
  it('accepts draft_content alone', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      draft_content: 'Updated post text',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.draft_content).toBe('Updated post text');
    }
  });

  it('accepts mark_edited alone', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      mark_edited: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mark_edited).toBe(true);
    }
  });

  it('accepts image_storage_path as string', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      image_storage_path: 'user-1/post-1/hero.png',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.image_storage_path).toBe('user-1/post-1/hero.png');
    }
  });

  it('accepts image_storage_path as null (removal)', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      image_storage_path: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.image_storage_path).toBeNull();
    }
  });

  it('rejects empty body (no fields)', () => {
    const result = ContentQueueUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('At least one field must be provided');
    }
  });

  it('rejects draft_content as empty string (min 1)', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      draft_content: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('draft_content cannot be empty');
    }
  });

  it('accepts image_storage_path combined with draft_content', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      draft_content: 'Post with image',
      image_storage_path: 'user-1/post-1/hero.png',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.draft_content).toBe('Post with image');
      expect(result.data.image_storage_path).toBe('user-1/post-1/hero.png');
    }
  });
});
