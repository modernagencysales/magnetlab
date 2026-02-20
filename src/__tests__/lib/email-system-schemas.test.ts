/**
 * @jest-environment node
 */

import {
  createFlowSchema,
  updateFlowSchema,
  createStepSchema,
  updateStepSchema,
  createSubscriberSchema,
  audienceFilterSchema,
  createBroadcastSchema,
  updateBroadcastSchema,
} from '@/lib/types/email-system';

import {
  generateUnsubscribeToken,
  generateUnsubscribeUrl,
  buildEmailFooterHtml,
} from '@/lib/integrations/resend';

// ============================================
// Test 1: Zod Schema Validation
// ============================================

describe('Email System Zod Schemas', () => {
  // ------------------------------------------
  // createFlowSchema
  // ------------------------------------------
  describe('createFlowSchema', () => {
    it('accepts a valid lead_magnet flow with all fields', () => {
      const payload = {
        name: 'Welcome Sequence',
        description: 'Onboarding drip for new subscribers',
        trigger_type: 'lead_magnet' as const,
        trigger_lead_magnet_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(payload);
      }
    });

    it('accepts a valid manual flow with only required fields', () => {
      const payload = {
        name: 'Quick Broadcast',
        trigger_type: 'manual' as const,
      };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects missing name', () => {
      const payload = { trigger_type: 'manual' };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects empty string name', () => {
      const payload = { name: '', trigger_type: 'manual' };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects name longer than 200 characters', () => {
      const payload = { name: 'x'.repeat(201), trigger_type: 'lead_magnet' };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('accepts name at exactly 200 characters', () => {
      const payload = { name: 'x'.repeat(200), trigger_type: 'manual' };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects missing trigger_type', () => {
      const payload = { name: 'My Flow' };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects invalid trigger_type', () => {
      const payload = { name: 'My Flow', trigger_type: 'webhook' };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects description longer than 1000 characters', () => {
      const payload = {
        name: 'Test',
        trigger_type: 'manual',
        description: 'a'.repeat(1001),
      };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('accepts description at exactly 1000 characters', () => {
      const payload = {
        name: 'Test',
        trigger_type: 'manual',
        description: 'a'.repeat(1000),
      };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID trigger_lead_magnet_id', () => {
      const payload = {
        name: 'Test',
        trigger_type: 'lead_magnet',
        trigger_lead_magnet_id: 'not-a-uuid',
      };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects numeric name', () => {
      const payload = { name: 12345, trigger_type: 'manual' };
      const result = createFlowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // ------------------------------------------
  // updateFlowSchema
  // ------------------------------------------
  describe('updateFlowSchema', () => {
    it('accepts updating only name', () => {
      const result = updateFlowSchema.safeParse({ name: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    it('accepts updating only status', () => {
      const result = updateFlowSchema.safeParse({ status: 'active' });
      expect(result.success).toBe(true);
    });

    it('accepts all valid statuses', () => {
      for (const status of ['draft', 'active', 'paused'] as const) {
        const result = updateFlowSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      const result = updateFlowSchema.safeParse({ status: 'deleted' });
      expect(result.success).toBe(false);
    });

    it('accepts an empty object (all optional)', () => {
      const result = updateFlowSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts nullable trigger_lead_magnet_id', () => {
      const result = updateFlowSchema.safeParse({
        trigger_lead_magnet_id: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trigger_lead_magnet_id).toBeNull();
      }
    });

    it('accepts valid UUID trigger_lead_magnet_id', () => {
      const result = updateFlowSchema.safeParse({
        trigger_lead_magnet_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID trigger_lead_magnet_id', () => {
      const result = updateFlowSchema.safeParse({
        trigger_lead_magnet_id: 'abc123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty string name', () => {
      const result = updateFlowSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects name over 200 characters', () => {
      const result = updateFlowSchema.safeParse({ name: 'x'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('accepts updating multiple fields at once', () => {
      const result = updateFlowSchema.safeParse({
        name: 'New Name',
        status: 'paused',
        trigger_type: 'lead_magnet',
        description: 'Updated description',
      });
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------
  // createStepSchema
  // ------------------------------------------
  describe('createStepSchema', () => {
    it('accepts a valid step', () => {
      const payload = {
        step_number: 0,
        subject: 'Welcome to MagnetLab!',
        body: '<p>Thanks for signing up.</p>',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('accepts step_number of 0', () => {
      const payload = {
        step_number: 0,
        subject: 'Intro',
        body: 'Body content',
        delay_days: 1,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('accepts delay_days of 365', () => {
      const payload = {
        step_number: 1,
        subject: 'Annual reminder',
        body: 'A year later...',
        delay_days: 365,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects delay_days over 365', () => {
      const payload = {
        step_number: 1,
        subject: 'Too late',
        body: 'Delayed too long',
        delay_days: 366,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects negative delay_days', () => {
      const payload = {
        step_number: 0,
        subject: 'Subject',
        body: 'Body',
        delay_days: -1,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects negative step_number', () => {
      const payload = {
        step_number: -1,
        subject: 'Subject',
        body: 'Body',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer step_number', () => {
      const payload = {
        step_number: 1.5,
        subject: 'Subject',
        body: 'Body',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer delay_days', () => {
      const payload = {
        step_number: 0,
        subject: 'Subject',
        body: 'Body',
        delay_days: 2.5,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects empty subject', () => {
      const payload = {
        step_number: 0,
        subject: '',
        body: 'Body content',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects subject over 500 characters', () => {
      const payload = {
        step_number: 0,
        subject: 'x'.repeat(501),
        body: 'Body',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('accepts subject at exactly 500 characters', () => {
      const payload = {
        step_number: 0,
        subject: 'x'.repeat(500),
        body: 'Body',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects empty body', () => {
      const payload = {
        step_number: 0,
        subject: 'Subject',
        body: '',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = createStepSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects when step_number is missing', () => {
      const payload = {
        subject: 'Subject',
        body: 'Body',
        delay_days: 0,
      };
      const result = createStepSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // ------------------------------------------
  // updateStepSchema
  // ------------------------------------------
  describe('updateStepSchema', () => {
    it('accepts an empty object', () => {
      const result = updateStepSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts updating only subject', () => {
      const result = updateStepSchema.safeParse({ subject: 'New Subject' });
      expect(result.success).toBe(true);
    });

    it('accepts updating only body', () => {
      const result = updateStepSchema.safeParse({ body: 'New body content' });
      expect(result.success).toBe(true);
    });

    it('accepts updating only delay_days', () => {
      const result = updateStepSchema.safeParse({ delay_days: 7 });
      expect(result.success).toBe(true);
    });

    it('accepts updating only step_number', () => {
      const result = updateStepSchema.safeParse({ step_number: 3 });
      expect(result.success).toBe(true);
    });

    it('rejects empty subject when provided', () => {
      const result = updateStepSchema.safeParse({ subject: '' });
      expect(result.success).toBe(false);
    });

    it('rejects empty body when provided', () => {
      const result = updateStepSchema.safeParse({ body: '' });
      expect(result.success).toBe(false);
    });

    it('rejects delay_days over 365 when provided', () => {
      const result = updateStepSchema.safeParse({ delay_days: 400 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer delay_days when provided', () => {
      const result = updateStepSchema.safeParse({ delay_days: 3.14 });
      expect(result.success).toBe(false);
    });

    it('rejects negative step_number when provided', () => {
      const result = updateStepSchema.safeParse({ step_number: -2 });
      expect(result.success).toBe(false);
    });

    it('accepts updating all fields at once', () => {
      const result = updateStepSchema.safeParse({
        subject: 'Updated Subject',
        body: 'Updated body',
        delay_days: 14,
        step_number: 2,
      });
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------
  // createSubscriberSchema
  // ------------------------------------------
  describe('createSubscriberSchema', () => {
    it('accepts a valid email with all fields', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'test@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('accepts email only (names are optional)', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'user@company.io',
      });
      expect(result.success).toBe(true);
    });

    it('lowercases the email', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'USER@Example.COM',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('rejects whitespace-padded email (email() validates before transform)', () => {
      // Zod's .email() validator runs before .transform(), so leading/trailing
      // whitespace causes validation failure before trim can run
      const result = createSubscriberSchema.safeParse({
        email: '  hello@test.com  ',
      });
      expect(result.success).toBe(false);
    });

    it('lowercases email that has no surrounding whitespace', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'UPPER@CASE.COM',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('upper@case.com');
      }
    });

    it('rejects invalid email format', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty email', () => {
      const result = createSubscriberSchema.safeParse({ email: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing email', () => {
      const result = createSubscriberSchema.safeParse({
        first_name: 'Jane',
      });
      expect(result.success).toBe(false);
    });

    it('rejects first_name over 200 characters', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'ok@test.com',
        first_name: 'x'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('accepts first_name at exactly 200 characters', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'ok@test.com',
        first_name: 'x'.repeat(200),
      });
      expect(result.success).toBe(true);
    });

    it('rejects last_name over 200 characters', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'ok@test.com',
        last_name: 'y'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('accepts last_name at exactly 200 characters', () => {
      const result = createSubscriberSchema.safeParse({
        email: 'ok@test.com',
        last_name: 'y'.repeat(200),
      });
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------
  // audienceFilterSchema
  // ------------------------------------------
  describe('audienceFilterSchema', () => {
    it('accepts undefined (whole schema is optional)', () => {
      const result = audienceFilterSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('accepts an empty object', () => {
      const result = audienceFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts all valid engagement values', () => {
      const validValues = [
        'opened_30d',
        'opened_60d',
        'opened_90d',
        'clicked_30d',
        'clicked_60d',
        'clicked_90d',
        'never_opened',
      ] as const;

      for (const engagement of validValues) {
        const result = audienceFilterSchema.safeParse({ engagement });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid engagement value', () => {
      const result = audienceFilterSchema.safeParse({
        engagement: 'opened_7d',
      });
      expect(result.success).toBe(false);
    });

    it('accepts source as any string', () => {
      const result = audienceFilterSchema.safeParse({
        source: 'lead_magnet',
      });
      expect(result.success).toBe(true);
    });

    it('accepts both engagement and source together', () => {
      const result = audienceFilterSchema.safeParse({
        engagement: 'clicked_30d',
        source: 'import',
      });
      expect(result.success).toBe(true);
    });

    it('accepts only source without engagement', () => {
      const result = audienceFilterSchema.safeParse({ source: 'manual' });
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------
  // createBroadcastSchema
  // ------------------------------------------
  describe('createBroadcastSchema', () => {
    it('accepts an empty object (all optional)', () => {
      const result = createBroadcastSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts subject and body', () => {
      const result = createBroadcastSchema.safeParse({
        subject: 'Big Announcement',
        body: '<p>We have exciting news!</p>',
      });
      expect(result.success).toBe(true);
    });

    it('accepts only subject', () => {
      const result = createBroadcastSchema.safeParse({
        subject: 'Test Subject',
      });
      expect(result.success).toBe(true);
    });

    it('accepts only body', () => {
      const result = createBroadcastSchema.safeParse({
        body: 'Just body text',
      });
      expect(result.success).toBe(true);
    });

    it('rejects subject over 500 characters', () => {
      const result = createBroadcastSchema.safeParse({
        subject: 's'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('accepts subject at exactly 500 characters', () => {
      const result = createBroadcastSchema.safeParse({
        subject: 's'.repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty string subject (no min length)', () => {
      const result = createBroadcastSchema.safeParse({ subject: '' });
      expect(result.success).toBe(true);
    });

    it('accepts empty string body (no min length)', () => {
      const result = createBroadcastSchema.safeParse({ body: '' });
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------
  // updateBroadcastSchema
  // ------------------------------------------
  describe('updateBroadcastSchema', () => {
    it('accepts an empty object', () => {
      const result = updateBroadcastSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts updating subject and body', () => {
      const result = updateBroadcastSchema.safeParse({
        subject: 'Updated Subject',
        body: '<p>Updated body</p>',
      });
      expect(result.success).toBe(true);
    });

    it('accepts audience_filter with valid engagement', () => {
      const result = updateBroadcastSchema.safeParse({
        audience_filter: { engagement: 'opened_30d' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts null audience_filter', () => {
      const result = updateBroadcastSchema.safeParse({
        audience_filter: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.audience_filter).toBeNull();
      }
    });

    it('accepts undefined audience_filter', () => {
      const result = updateBroadcastSchema.safeParse({
        subject: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.audience_filter).toBeUndefined();
      }
    });

    it('rejects invalid engagement in audience_filter', () => {
      const result = updateBroadcastSchema.safeParse({
        audience_filter: { engagement: 'invalid_value' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects subject over 500 characters', () => {
      const result = updateBroadcastSchema.safeParse({
        subject: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('accepts audience_filter with source only', () => {
      const result = updateBroadcastSchema.safeParse({
        audience_filter: { source: 'lead_magnet' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts all three fields together', () => {
      const result = updateBroadcastSchema.safeParse({
        subject: 'Full update',
        body: 'New body content',
        audience_filter: {
          engagement: 'never_opened',
          source: 'import',
        },
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Test 2: HMAC Unsubscribe Functions
// ============================================

describe('HMAC Unsubscribe Functions', () => {
  const TEST_SECRET = 'test-secret-123';
  const SUBSCRIBER_ID = 'sub_abc123def456';

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    // Clear NEXTAUTH_URL so default is used unless overridden
    delete process.env.NEXTAUTH_URL;
  });

  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  // ------------------------------------------
  // generateUnsubscribeToken
  // ------------------------------------------
  describe('generateUnsubscribeToken', () => {
    it('returns a deterministic token for the same input', () => {
      const token1 = generateUnsubscribeToken(SUBSCRIBER_ID);
      const token2 = generateUnsubscribeToken(SUBSCRIBER_ID);
      expect(token1).toBe(token2);
    });

    it('returns a 32-character hex string', () => {
      const token = generateUnsubscribeToken(SUBSCRIBER_ID);
      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    it('produces different tokens for different subscriber IDs', () => {
      const token1 = generateUnsubscribeToken('subscriber-aaa');
      const token2 = generateUnsubscribeToken('subscriber-bbb');
      expect(token1).not.toBe(token2);
    });

    it('produces different tokens for subtly different IDs', () => {
      const token1 = generateUnsubscribeToken('sub_001');
      const token2 = generateUnsubscribeToken('sub_002');
      expect(token1).not.toBe(token2);
    });

    it('throws when NEXTAUTH_SECRET is not set', () => {
      delete process.env.NEXTAUTH_SECRET;
      expect(() => generateUnsubscribeToken(SUBSCRIBER_ID)).toThrow(
        'NEXTAUTH_SECRET is required for unsubscribe token generation'
      );
    });

    it('throws when NEXTAUTH_SECRET is empty string', () => {
      process.env.NEXTAUTH_SECRET = '';
      // Empty string is falsy, so the check `if (!secret)` should throw
      expect(() => generateUnsubscribeToken(SUBSCRIBER_ID)).toThrow(
        'NEXTAUTH_SECRET is required for unsubscribe token generation'
      );
    });

    it('handles UUID subscriber IDs', () => {
      const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const token = generateUnsubscribeToken(uuid);
      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  // ------------------------------------------
  // generateUnsubscribeUrl
  // ------------------------------------------
  describe('generateUnsubscribeUrl', () => {
    it('contains the correct path', () => {
      const url = generateUnsubscribeUrl(SUBSCRIBER_ID);
      expect(url).toContain('/api/email/unsubscribe');
    });

    it('contains the sid query parameter', () => {
      const url = generateUnsubscribeUrl(SUBSCRIBER_ID);
      expect(url).toContain(`sid=${SUBSCRIBER_ID}`);
    });

    it('contains the token query parameter', () => {
      const token = generateUnsubscribeToken(SUBSCRIBER_ID);
      const url = generateUnsubscribeUrl(SUBSCRIBER_ID);
      expect(url).toContain(`token=${token}`);
    });

    it('uses default base URL when NEXTAUTH_URL is not set', () => {
      delete process.env.NEXTAUTH_URL;
      const url = generateUnsubscribeUrl(SUBSCRIBER_ID);
      expect(url).toMatch(/^https:\/\/magnetlab\.app\/api\/email\/unsubscribe/);
    });

    it('uses NEXTAUTH_URL when set', () => {
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      const url = generateUnsubscribeUrl(SUBSCRIBER_ID);
      expect(url).toMatch(/^http:\/\/localhost:3000\/api\/email\/unsubscribe/);
    });

    it('produces a valid URL format', () => {
      const url = generateUnsubscribeUrl(SUBSCRIBER_ID);
      const parsed = new URL(url);
      expect(parsed.pathname).toBe('/api/email/unsubscribe');
      expect(parsed.searchParams.get('sid')).toBe(SUBSCRIBER_ID);
      expect(parsed.searchParams.get('token')).toHaveLength(32);
    });

    it('throws when NEXTAUTH_SECRET is not set', () => {
      delete process.env.NEXTAUTH_SECRET;
      expect(() => generateUnsubscribeUrl(SUBSCRIBER_ID)).toThrow(
        'NEXTAUTH_SECRET is required'
      );
    });
  });

  // ------------------------------------------
  // buildEmailFooterHtml
  // ------------------------------------------
  describe('buildEmailFooterHtml', () => {
    it('returns HTML containing the unsubscribe URL', () => {
      const footer = buildEmailFooterHtml(SUBSCRIBER_ID);
      const expectedUrl = generateUnsubscribeUrl(SUBSCRIBER_ID);
      expect(footer).toContain(expectedUrl);
    });

    it('contains an anchor tag with the unsubscribe link', () => {
      const footer = buildEmailFooterHtml(SUBSCRIBER_ID);
      expect(footer).toContain('<a href=');
      expect(footer).toContain('Unsubscribe');
    });

    it('contains subscription messaging text', () => {
      const footer = buildEmailFooterHtml(SUBSCRIBER_ID);
      expect(footer).toContain('receiving this because you subscribed');
    });

    it('contains a horizontal rule separator', () => {
      const footer = buildEmailFooterHtml(SUBSCRIBER_ID);
      expect(footer).toContain('<hr');
    });

    it('returns different HTML for different subscriber IDs', () => {
      const footer1 = buildEmailFooterHtml('subscriber-aaa');
      const footer2 = buildEmailFooterHtml('subscriber-bbb');
      expect(footer1).not.toBe(footer2);
    });

    it('throws when NEXTAUTH_SECRET is not set', () => {
      delete process.env.NEXTAUTH_SECRET;
      expect(() => buildEmailFooterHtml(SUBSCRIBER_ID)).toThrow(
        'NEXTAUTH_SECRET is required'
      );
    });
  });
});
