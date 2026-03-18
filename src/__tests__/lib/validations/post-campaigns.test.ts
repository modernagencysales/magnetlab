/**
 * Zod schema tests for post campaign validation schemas.
 * Tests both CreatePostCampaignSchema and UpdatePostCampaignSchema.
 */

import { CreatePostCampaignSchema, UpdatePostCampaignSchema } from '@/lib/validations/api';

describe('CreatePostCampaignSchema', () => {
  const validInput = {
    name: 'Test Campaign',
    post_url: 'https://www.linkedin.com/posts/example-123',
    keywords: ['interested', 'send it'],
    unipile_account_id: 'acc_123',
    dm_template: 'Hey {{name}}, check this out: {{funnel_url}}',
  };

  it('should accept valid input with required fields only', () => {
    const result = CreatePostCampaignSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid input with all optional fields', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      sender_name: 'Tim',
      connect_message_template: 'Hey, lets connect!',
      reply_template: 'Hey {{name}}! Accept my connection request.',
      poster_account_id: 'poster_acc_456',
      target_locations: ['New York', 'San Francisco'],
      lead_expiry_days: 14,
      funnel_page_id: '550e8400-e29b-41d4-a716-446655440000',
      auto_accept_connections: true,
      auto_like_comments: false,
      auto_connect_non_requesters: true,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid target_locations array', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      target_locations: ['US', 'UK', 'Canada'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject target_locations with empty strings', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      target_locations: [''],
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid lead_expiry_days', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      lead_expiry_days: 30,
    });
    expect(result.success).toBe(true);
  });

  it('should reject lead_expiry_days below 1', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      lead_expiry_days: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject lead_expiry_days above 90', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      lead_expiry_days: 91,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty poster_account_id', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      poster_account_id: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = CreatePostCampaignSchema.safeParse({ ...validInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject name over 200 characters', () => {
    const result = CreatePostCampaignSchema.safeParse({ ...validInput, name: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('should reject invalid post_url', () => {
    const result = CreatePostCampaignSchema.safeParse({ ...validInput, post_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should reject empty keywords array', () => {
    const result = CreatePostCampaignSchema.safeParse({ ...validInput, keywords: [] });
    expect(result.success).toBe(false);
  });

  it('should reject keywords with empty strings', () => {
    const result = CreatePostCampaignSchema.safeParse({ ...validInput, keywords: [''] });
    expect(result.success).toBe(false);
  });

  it('should reject empty unipile_account_id', () => {
    const result = CreatePostCampaignSchema.safeParse({ ...validInput, unipile_account_id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject empty dm_template', () => {
    const result = CreatePostCampaignSchema.safeParse({ ...validInput, dm_template: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = CreatePostCampaignSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject invalid funnel_page_id (not uuid)', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      funnel_page_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-boolean auto_accept_connections', () => {
    const result = CreatePostCampaignSchema.safeParse({
      ...validInput,
      auto_accept_connections: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdatePostCampaignSchema', () => {
  it('should accept empty object (all fields optional)', () => {
    const result = UpdatePostCampaignSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid partial update', () => {
    const result = UpdatePostCampaignSchema.safeParse({
      name: 'Updated Campaign',
      status: 'active',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid fields including new ones', () => {
    const result = UpdatePostCampaignSchema.safeParse({
      name: 'Updated Campaign',
      post_url: 'https://linkedin.com/posts/new-123',
      dm_template: 'New template',
      connect_message_template: 'New connect msg',
      reply_template: 'Hey {{name}}! Sending you a connection request.',
      poster_account_id: 'poster_acc_789',
      target_locations: ['London', 'Berlin'],
      lead_expiry_days: 21,
      auto_accept_connections: false,
      auto_like_comments: true,
      auto_connect_non_requesters: false,
      daily_dm_limit: 25,
      daily_connection_limit: 10,
      status: 'paused',
    });
    expect(result.success).toBe(true);
  });

  it('should reject lead_expiry_days above 90 on update', () => {
    const result = UpdatePostCampaignSchema.safeParse({ lead_expiry_days: 100 });
    expect(result.success).toBe(false);
  });

  it('should accept target_locations update', () => {
    const result = UpdatePostCampaignSchema.safeParse({
      target_locations: ['US West Coast', 'US East Coast'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = UpdatePostCampaignSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should accept all valid statuses', () => {
    for (const status of ['draft', 'active', 'paused', 'completed']) {
      const result = UpdatePostCampaignSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('should reject daily_dm_limit below 1', () => {
    const result = UpdatePostCampaignSchema.safeParse({ daily_dm_limit: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject daily_dm_limit above 50', () => {
    const result = UpdatePostCampaignSchema.safeParse({ daily_dm_limit: 51 });
    expect(result.success).toBe(false);
  });

  it('should reject daily_connection_limit below 1', () => {
    const result = UpdatePostCampaignSchema.safeParse({ daily_connection_limit: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer daily_dm_limit', () => {
    const result = UpdatePostCampaignSchema.safeParse({ daily_dm_limit: 5.5 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid post_url when provided', () => {
    const result = UpdatePostCampaignSchema.safeParse({ post_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should reject empty name when provided', () => {
    const result = UpdatePostCampaignSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});
