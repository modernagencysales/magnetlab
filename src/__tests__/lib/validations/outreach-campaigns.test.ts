/**
 * Zod schema tests for outreach campaign validation schemas.
 * Tests CreateOutreachCampaignSchema, UpdateOutreachCampaignSchema,
 * AddOutreachLeadSchema, and AddOutreachLeadsBatchSchema.
 */

import {
  CreateOutreachCampaignSchema,
  UpdateOutreachCampaignSchema,
  AddOutreachLeadSchema,
  AddOutreachLeadsBatchSchema,
} from '@/lib/validations/outreach-campaigns';

// ─── CreateOutreachCampaignSchema ───────────────────────────────────────

describe('CreateOutreachCampaignSchema', () => {
  const validInput = {
    name: 'Warm Connect Campaign',
    preset: 'warm_connect',
    unipile_account_id: 'acc_123',
    first_message_template: 'Hey {{name}}, great to connect!',
  };

  it('should accept valid input with required fields only', () => {
    const result = CreateOutreachCampaignSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid input with all optional fields', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      connect_message: 'Hi, I would love to connect!',
      follow_up_template: 'Hey {{name}}, just following up...',
      follow_up_delay_days: 5,
      withdraw_delay_days: 14,
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid presets', () => {
    for (const preset of ['warm_connect', 'direct_connect', 'nurture']) {
      const result = CreateOutreachCampaignSchema.safeParse({ ...validInput, preset });
      expect(result.success).toBe(true);
    }
  });

  it('should reject missing name', () => {
    const { name: _, ...input } = validInput;
    const result = CreateOutreachCampaignSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = CreateOutreachCampaignSchema.safeParse({ ...validInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject name over 200 characters', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      name: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing preset', () => {
    const { preset: _, ...input } = validInput;
    const result = CreateOutreachCampaignSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid preset value', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      preset: 'aggressive_spam',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing unipile_account_id', () => {
    const { unipile_account_id: _, ...input } = validInput;
    const result = CreateOutreachCampaignSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty unipile_account_id', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      unipile_account_id: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing first_message_template', () => {
    const { first_message_template: _, ...input } = validInput;
    const result = CreateOutreachCampaignSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty first_message_template', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      first_message_template: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject connect_message over 300 characters', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      connect_message: 'a'.repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it('should reject follow_up_delay_days below 1', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      follow_up_delay_days: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject follow_up_delay_days above 30', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      follow_up_delay_days: 31,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer follow_up_delay_days', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      follow_up_delay_days: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject withdraw_delay_days below 1', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      withdraw_delay_days: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject withdraw_delay_days above 90', () => {
    const result = CreateOutreachCampaignSchema.safeParse({
      ...validInput,
      withdraw_delay_days: 91,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty object (missing all required fields)', () => {
    const result = CreateOutreachCampaignSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── UpdateOutreachCampaignSchema ───────────────────────────────────────

describe('UpdateOutreachCampaignSchema', () => {
  it('should accept empty object (all fields optional)', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid partial update with name only', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });

  it('should accept all fields together', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({
      name: 'Updated Campaign',
      connect_message: 'New connect message',
      first_message_template: 'New first message',
      follow_up_template: 'New follow up',
      follow_up_delay_days: 7,
      withdraw_delay_days: 30,
    });
    expect(result.success).toBe(true);
  });

  it('should accept null for nullable fields', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({
      connect_message: null,
      follow_up_template: null,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name when provided', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject empty first_message_template when provided', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({ first_message_template: '' });
    expect(result.success).toBe(false);
  });

  it('should reject follow_up_delay_days above 30', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({ follow_up_delay_days: 31 });
    expect(result.success).toBe(false);
  });

  it('should reject withdraw_delay_days above 90', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({ withdraw_delay_days: 91 });
    expect(result.success).toBe(false);
  });

  it('should reject connect_message over 300 characters', () => {
    const result = UpdateOutreachCampaignSchema.safeParse({
      connect_message: 'a'.repeat(301),
    });
    expect(result.success).toBe(false);
  });
});

// ─── AddOutreachLeadSchema ──────────────────────────────────────────────

describe('AddOutreachLeadSchema', () => {
  const validLead = {
    linkedin_url: 'https://www.linkedin.com/in/johndoe',
  };

  it('should accept valid LinkedIn URL', () => {
    const result = AddOutreachLeadSchema.safeParse(validLead);
    expect(result.success).toBe(true);
  });

  it('should accept LinkedIn URL with optional fields', () => {
    const result = AddOutreachLeadSchema.safeParse({
      ...validLead,
      name: 'John Doe',
      company: 'Acme Inc',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-URL string', () => {
    const result = AddOutreachLeadSchema.safeParse({ linkedin_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should reject non-LinkedIn URL', () => {
    const result = AddOutreachLeadSchema.safeParse({
      linkedin_url: 'https://www.twitter.com/johndoe',
    });
    expect(result.success).toBe(false);
  });

  it('should reject LinkedIn company URL (not a profile)', () => {
    const result = AddOutreachLeadSchema.safeParse({
      linkedin_url: 'https://www.linkedin.com/company/acme',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing linkedin_url', () => {
    const result = AddOutreachLeadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject name over 200 characters', () => {
    const result = AddOutreachLeadSchema.safeParse({
      ...validLead,
      name: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('should reject company over 200 characters', () => {
    const result = AddOutreachLeadSchema.safeParse({
      ...validLead,
      company: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

// ─── AddOutreachLeadsBatchSchema ────────────────────────────────────────

describe('AddOutreachLeadsBatchSchema', () => {
  it('should accept valid batch with one lead', () => {
    const result = AddOutreachLeadsBatchSchema.safeParse({
      leads: [{ linkedin_url: 'https://www.linkedin.com/in/johndoe' }],
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid batch with multiple leads', () => {
    const result = AddOutreachLeadsBatchSchema.safeParse({
      leads: [
        { linkedin_url: 'https://www.linkedin.com/in/johndoe', name: 'John' },
        { linkedin_url: 'https://www.linkedin.com/in/janedoe', company: 'Acme' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty leads array', () => {
    const result = AddOutreachLeadsBatchSchema.safeParse({ leads: [] });
    expect(result.success).toBe(false);
  });

  it('should reject missing leads field', () => {
    const result = AddOutreachLeadsBatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject batch with invalid lead', () => {
    const result = AddOutreachLeadsBatchSchema.safeParse({
      leads: [{ linkedin_url: 'https://twitter.com/johndoe' }],
    });
    expect(result.success).toBe(false);
  });
});
