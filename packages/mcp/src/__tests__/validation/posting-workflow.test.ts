/** Tests for post campaign schema drift fixes — sender_name, connect_message_template, lead_expiry_days. */

import { describe, it, expect } from 'vitest';
import { toolSchemas } from '../../validation.js';

describe('post campaign schema drift fixes', () => {
  it('should accept sender_name in create', () => {
    const schema = toolSchemas.magnetlab_create_post_campaign;
    const result = schema.safeParse({
      name: 'Test',
      post_url: 'https://linkedin.com/post/123',
      keywords: ['BLUEPRINT'],
      unipile_account_id: 'acct-1',
      dm_template: 'Hey {{name}}',
      sender_name: 'Vlad',
      connect_message_template: 'Hi {{name}}!',
      lead_expiry_days: 14,
    });
    expect(result.success).toBe(true);
  });

  it('should accept connect_message_template in update', () => {
    const schema = toolSchemas.magnetlab_update_post_campaign;
    const result = schema.safeParse({
      campaign_id: 'some-id',
      connect_message_template: 'Hello {{name}}',
      lead_expiry_days: 7,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative lead_expiry_days', () => {
    const schema = toolSchemas.magnetlab_create_post_campaign;
    const result = schema.safeParse({
      name: 'Test',
      post_url: 'https://linkedin.com/post/123',
      keywords: ['BLUEPRINT'],
      unipile_account_id: 'acct-1',
      dm_template: 'Hey {{name}}',
      lead_expiry_days: -5,
    });
    expect(result.success).toBe(false);
  });

  it('should accept sender_name in update', () => {
    const schema = toolSchemas.magnetlab_update_post_campaign;
    const result = schema.safeParse({
      campaign_id: 'some-id',
      sender_name: 'Tim',
    });
    expect(result.success).toBe(true);
  });

  it('should reject zero lead_expiry_days (must be positive)', () => {
    const schema = toolSchemas.magnetlab_update_post_campaign;
    const result = schema.safeParse({
      campaign_id: 'some-id',
      lead_expiry_days: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should accept all three new fields together in create', () => {
    const schema = toolSchemas.magnetlab_create_post_campaign;
    const result = schema.safeParse({
      name: 'Full Campaign',
      post_url: 'https://www.linkedin.com/posts/test-12345',
      keywords: ['guide', 'send'],
      unipile_account_id: 'acc-123',
      dm_template: 'Hey {{first_name}}, here is your guide: {{funnel_url}}',
      sender_name: 'Vlad',
      connect_message_template: 'Hi {{name}}, I noticed you commented on my post!',
      lead_expiry_days: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sender_name).toBe('Vlad');
      expect(result.data.connect_message_template).toBe(
        'Hi {{name}}, I noticed you commented on my post!'
      );
      expect(result.data.lead_expiry_days).toBe(30);
    }
  });

  it('new fields are optional in create — existing required fields still enforced', () => {
    const schema = toolSchemas.magnetlab_create_post_campaign;
    // Missing required fields should still fail
    const result = schema.safeParse({
      name: 'Test',
      sender_name: 'Vlad',
    });
    expect(result.success).toBe(false);
  });
});
