import { describe, it, expect } from 'vitest';
import { getEmailMarketingProvider, isEmailMarketingProvider } from '../index';
import { KitProvider } from '../providers/kit';
import { MailerLiteProvider } from '../providers/mailerlite';
import { MailchimpProvider } from '../providers/mailchimp';
import { ActiveCampaignProvider } from '../providers/activecampaign';

// Mock the Supabase and encrypted-storage imports so the module loads without env vars
import { vi } from 'vitest';
vi.mock('@/lib/utils/encrypted-storage', () => ({
  getUserIntegration: vi.fn(),
}));
vi.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

describe('getEmailMarketingProvider', () => {
  const credentials = { apiKey: 'test-key-123' };

  it('returns KitProvider for "kit"', () => {
    const provider = getEmailMarketingProvider('kit', credentials);
    expect(provider).toBeInstanceOf(KitProvider);
  });

  it('returns MailerLiteProvider for "mailerlite"', () => {
    const provider = getEmailMarketingProvider('mailerlite', credentials);
    expect(provider).toBeInstanceOf(MailerLiteProvider);
  });

  it('returns MailchimpProvider for "mailchimp"', () => {
    const provider = getEmailMarketingProvider('mailchimp', {
      apiKey: 'test-key-123',
      metadata: { server_prefix: 'us1' },
    });
    expect(provider).toBeInstanceOf(MailchimpProvider);
  });

  it('returns ActiveCampaignProvider for "activecampaign"', () => {
    const provider = getEmailMarketingProvider('activecampaign', {
      apiKey: 'test-key-123',
      metadata: { base_url: 'https://myaccount.api-us1.com' },
    });
    expect(provider).toBeInstanceOf(ActiveCampaignProvider);
  });

  it('throws for unknown provider name', () => {
    expect(() => getEmailMarketingProvider('sendgrid', credentials)).toThrow(
      'Unknown email marketing provider: sendgrid'
    );
  });

  it('throws for empty string', () => {
    expect(() => getEmailMarketingProvider('', credentials)).toThrow(
      'Unknown email marketing provider: '
    );
  });
});

describe('isEmailMarketingProvider', () => {
  it('returns true for "kit"', () => {
    expect(isEmailMarketingProvider('kit')).toBe(true);
  });

  it('returns true for "mailerlite"', () => {
    expect(isEmailMarketingProvider('mailerlite')).toBe(true);
  });

  it('returns true for "mailchimp"', () => {
    expect(isEmailMarketingProvider('mailchimp')).toBe(true);
  });

  it('returns true for "activecampaign"', () => {
    expect(isEmailMarketingProvider('activecampaign')).toBe(true);
  });

  it('returns false for unknown provider', () => {
    expect(isEmailMarketingProvider('sendgrid')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEmailMarketingProvider('')).toBe(false);
  });

  it('returns false for uppercase variant', () => {
    expect(isEmailMarketingProvider('Kit')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isEmailMarketingProvider('mail')).toBe(false);
  });
});
