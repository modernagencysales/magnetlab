/**
 * @jest-environment node
 *
 * Mixer Validation Schema Tests
 * Covers MixSchema, InventoryQuerySchema, RecipeQuerySchema, ComboPerformanceQuerySchema.
 * Pure Zod tests — no mocks needed.
 */

import {
  MixSchema,
  InventoryQuerySchema,
  RecipeQuerySchema,
  ComboPerformanceQuerySchema,
} from '@/lib/validations/mixer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const ANOTHER_UUID = '987fbc97-4bed-5078-af07-9141ba07c9f3';

const BASE_INPUT = { team_profile_id: VALID_UUID };

// ─── MixSchema ─────────────────────────────────────────────────────────────────

describe('MixSchema', () => {
  describe('ingredient requirement', () => {
    it('requires at least one ingredient', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT });
      expect(result.success).toBe(false);
    });

    it('rejects input with only hook (hook is direction, not an ingredient)', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, hook: 'A compelling hook line' });
      expect(result.success).toBe(false);
    });

    it('rejects input with only instructions (instructions are direction, not an ingredient)', () => {
      const result = MixSchema.safeParse({
        ...BASE_INPUT,
        instructions: 'Write in a casual tone.',
      });
      expect(result.success).toBe(false);
    });

    it('rejects input with only hook and instructions (still no real ingredient)', () => {
      const result = MixSchema.safeParse({
        ...BASE_INPUT,
        hook: 'Some hook',
        instructions: 'Some instructions',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('valid inputs — single ingredient', () => {
    it('accepts valid input with exploit_id only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with knowledge_topic only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, knowledge_topic: 'LinkedIn Growth' });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with knowledge_query only', () => {
      const result = MixSchema.safeParse({
        ...BASE_INPUT,
        knowledge_query: 'What drives engagement on LinkedIn?',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with style_id only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, style_id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with template_id only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, template_id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with creative_id only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, creative_id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with trend_topic only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, trend_topic: 'AI in B2B sales' });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with recycled_post_id only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, recycled_post_id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with idea_id only', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, idea_id: VALID_UUID });
      expect(result.success).toBe(true);
    });
  });

  describe('valid inputs — multiple ingredients', () => {
    it('accepts exploit_id + knowledge_topic together', () => {
      const result = MixSchema.safeParse({
        ...BASE_INPUT,
        exploit_id: VALID_UUID,
        knowledge_topic: 'Lead generation strategies',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all ingredient types combined', () => {
      const result = MixSchema.safeParse({
        ...BASE_INPUT,
        exploit_id: VALID_UUID,
        knowledge_topic: 'Sales tactics',
        knowledge_query: 'What closes deals?',
        style_id: ANOTHER_UUID,
        template_id: VALID_UUID,
        creative_id: ANOTHER_UUID,
        trend_topic: 'AI sales tools',
        recycled_post_id: VALID_UUID,
        idea_id: ANOTHER_UUID,
        hook: 'The truth about cold outreach...',
        instructions: 'Keep it conversational.',
        count: 5,
        output: 'ideas',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('defaults', () => {
    it('defaults count to 3 when omitted', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: VALID_UUID });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(3);
      }
    });

    it('defaults output to "drafts" when omitted', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: VALID_UUID });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.output).toBe('drafts');
      }
    });

    it('accepts output as "ideas"', () => {
      const result = MixSchema.safeParse({
        ...BASE_INPUT,
        exploit_id: VALID_UUID,
        output: 'ideas',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.output).toBe('ideas');
      }
    });
  });

  describe('count validation', () => {
    it('rejects count > 5', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: VALID_UUID, count: 6 });
      expect(result.success).toBe(false);
    });

    it('accepts count = 5', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: VALID_UUID, count: 5 });
      expect(result.success).toBe(true);
    });

    it('accepts count = 1', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: VALID_UUID, count: 1 });
      expect(result.success).toBe(true);
    });

    it('rejects count = 0', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: VALID_UUID, count: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('UUID validation on ID fields', () => {
    it('rejects exploit_id that is not a UUID', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, exploit_id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects style_id that is not a UUID', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, style_id: 'bad-id' });
      expect(result.success).toBe(false);
    });

    it('rejects template_id that is not a UUID', () => {
      const result = MixSchema.safeParse({ ...BASE_INPUT, template_id: '12345' });
      expect(result.success).toBe(false);
    });

    it('rejects team_profile_id that is not a UUID', () => {
      const result = MixSchema.safeParse({ team_profile_id: 'not-a-uuid', exploit_id: VALID_UUID });
      expect(result.success).toBe(false);
    });
  });
});

// ─── InventoryQuerySchema ──────────────────────────────────────────────────────

describe('InventoryQuerySchema', () => {
  it('requires team_profile_id', () => {
    const result = InventoryQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('validates UUID format for team_profile_id', () => {
    const result = InventoryQuerySchema.safeParse({ team_profile_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid UUID for team_profile_id', () => {
    const result = InventoryQuerySchema.safeParse({ team_profile_id: VALID_UUID });
    expect(result.success).toBe(true);
  });
});

// ─── RecipeQuerySchema ─────────────────────────────────────────────────────────

describe('RecipeQuerySchema', () => {
  it('requires team_profile_id', () => {
    const result = RecipeQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('defaults limit to 5 when omitted', () => {
    const result = RecipeQuerySchema.safeParse({ team_profile_id: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
    }
  });

  it('rejects limit > 20', () => {
    const result = RecipeQuerySchema.safeParse({ team_profile_id: VALID_UUID, limit: 21 });
    expect(result.success).toBe(false);
  });

  it('accepts limit = 20', () => {
    const result = RecipeQuerySchema.safeParse({ team_profile_id: VALID_UUID, limit: 20 });
    expect(result.success).toBe(true);
  });

  it('coerces string limit to number', () => {
    const result = RecipeQuerySchema.safeParse({ team_profile_id: VALID_UUID, limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });
});

// ─── ComboPerformanceQuerySchema ──────────────────────────────────────────────

describe('ComboPerformanceQuerySchema', () => {
  it('requires team_profile_id', () => {
    const result = ComboPerformanceQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('defaults limit to 10 when omitted', () => {
    const result = ComboPerformanceQuerySchema.safeParse({ team_profile_id: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it('rejects limit > 50', () => {
    const result = ComboPerformanceQuerySchema.safeParse({
      team_profile_id: VALID_UUID,
      limit: 51,
    });
    expect(result.success).toBe(false);
  });

  it('accepts limit = 50', () => {
    const result = ComboPerformanceQuerySchema.safeParse({
      team_profile_id: VALID_UUID,
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('coerces string limit to number', () => {
    const result = ComboPerformanceQuerySchema.safeParse({
      team_profile_id: VALID_UUID,
      limit: '25',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });
});
