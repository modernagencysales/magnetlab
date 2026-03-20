/**
 * Zod schema tests for DM Coach validation schemas.
 * Tests CreateContactSchema, UpdateContactSchema, and AddMessagesSchema.
 */

import {
  CreateContactSchema,
  UpdateContactSchema,
  AddMessagesSchema,
} from '@/lib/validations/dm-coach';

// ─── CreateContactSchema ─────────────────────────────────────────────────

describe('CreateContactSchema', () => {
  const validInput = {
    name: 'Jane Smith',
  };

  it('should accept valid input with name only', () => {
    const result = CreateContactSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid input with all optional fields', () => {
    const result = CreateContactSchema.safeParse({
      ...validInput,
      linkedin_url: 'https://www.linkedin.com/in/janesmith',
      headline: 'VP of Sales at Acme Corp',
      company: 'Acme Corp',
      location: 'New York, NY',
      conversation_goal: 'book_meeting',
      notes: 'Met at conference last week. Interested in AI tools.',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid goal values', () => {
    for (const goal of [
      'book_meeting',
      'build_relationship',
      'promote_content',
      'explore_partnership',
      'nurture_lead',
      'close_deal',
    ]) {
      const result = CreateContactSchema.safeParse({
        ...validInput,
        conversation_goal: goal,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject missing name', () => {
    const result = CreateContactSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = CreateContactSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject name over 200 characters', () => {
    const result = CreateContactSchema.safeParse({
      name: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid goal value', () => {
    const result = CreateContactSchema.safeParse({
      ...validInput,
      conversation_goal: 'spam_them',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid linkedin_url (not a URL)', () => {
    const result = CreateContactSchema.safeParse({
      ...validInput,
      linkedin_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should reject headline over 500 characters', () => {
    const result = CreateContactSchema.safeParse({
      ...validInput,
      headline: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject notes over 2000 characters', () => {
    const result = CreateContactSchema.safeParse({
      ...validInput,
      notes: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ─── UpdateContactSchema ─────────────────────────────────────────────────

describe('UpdateContactSchema', () => {
  it('should accept empty object (all fields optional)', () => {
    const result = UpdateContactSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept partial update with name only', () => {
    const result = UpdateContactSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });

  it('should accept all fields together', () => {
    const result = UpdateContactSchema.safeParse({
      name: 'Jane Doe',
      linkedin_url: 'https://www.linkedin.com/in/janedoe',
      headline: 'CTO at StartupCo',
      company: 'StartupCo',
      location: 'Austin, TX',
      conversation_goal: 'explore_partnership',
      qualification_stage: 'pain',
      status: 'active',
      notes: 'Follow up next week about integration.',
    });
    expect(result.success).toBe(true);
  });

  it('should accept null for nullable fields', () => {
    const result = UpdateContactSchema.safeParse({
      linkedin_url: null,
      headline: null,
      company: null,
      location: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid status values', () => {
    for (const status of ['active', 'paused', 'closed_won', 'closed_lost']) {
      const result = UpdateContactSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid qualification_stage values', () => {
    for (const stage of [
      'unknown',
      'situation',
      'pain',
      'impact',
      'vision',
      'capability',
      'commitment',
    ]) {
      const result = UpdateContactSchema.safeParse({ qualification_stage: stage });
      expect(result.success).toBe(true);
    }
  });

  it('should reject empty name when provided', () => {
    const result = UpdateContactSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = UpdateContactSchema.safeParse({ status: 'deleted' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid qualification_stage', () => {
    const result = UpdateContactSchema.safeParse({ qualification_stage: 'discovery' });
    expect(result.success).toBe(false);
  });
});

// ─── AddMessagesSchema ───────────────────────────────────────────────────

describe('AddMessagesSchema', () => {
  const validMessage = {
    role: 'them' as const,
    content: 'Hey, saw your post about AI tools for sales teams',
  };

  it('should accept valid single message', () => {
    const result = AddMessagesSchema.safeParse({
      messages: [validMessage],
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid batch of messages', () => {
    const result = AddMessagesSchema.safeParse({
      messages: [
        { role: 'them', content: 'Hey, saw your post about AI tools' },
        { role: 'me', content: 'Thanks! What caught your eye?' },
        { role: 'them', content: 'The part about automating outreach' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept message with optional timestamp', () => {
    const result = AddMessagesSchema.safeParse({
      messages: [
        {
          ...validMessage,
          timestamp: '2026-03-20T10:00:00Z',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept message without timestamp', () => {
    const result = AddMessagesSchema.safeParse({
      messages: [validMessage],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages[0].timestamp).toBeUndefined();
    }
  });

  it('should reject empty messages array', () => {
    const result = AddMessagesSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('should reject missing messages field', () => {
    const result = AddMessagesSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject message with empty content', () => {
    const result = AddMessagesSchema.safeParse({
      messages: [{ role: 'them', content: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject message with content over 5000 characters', () => {
    const result = AddMessagesSchema.safeParse({
      messages: [{ role: 'them', content: 'a'.repeat(5001) }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject message with invalid role', () => {
    const result = AddMessagesSchema.safeParse({
      messages: [{ role: 'bot', content: 'Hello' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 50 messages', () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'them' : 'me',
      content: `Message ${i + 1}`,
    }));
    const result = AddMessagesSchema.safeParse({ messages });
    expect(result.success).toBe(false);
  });
});
