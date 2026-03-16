/**
 * @jest-environment node
 */

import { renderDmTemplate, validateCampaignInput } from '@/server/services/post-campaigns.service';

// ─── renderDmTemplate ────────────────────────────────────────────────────────

describe('renderDmTemplate', () => {
  it('replaces {{name}} placeholder', () => {
    const result = renderDmTemplate('Hi {{name}}, welcome!', {
      name: 'Alice',
      funnel_url: 'https://example.com/funnel',
    });
    expect(result).toBe('Hi Alice, welcome!');
  });

  it('replaces {{funnel_url}} placeholder', () => {
    const result = renderDmTemplate('Check this out: {{funnel_url}}', {
      name: 'Bob',
      funnel_url: 'https://magnetlab.app/p/bob/guide',
    });
    expect(result).toBe('Check this out: https://magnetlab.app/p/bob/guide');
  });

  it('replaces both placeholders in one template', () => {
    const result = renderDmTemplate('Hey {{name}}, grab your guide at {{funnel_url}}', {
      name: 'Carol',
      funnel_url: 'https://magnetlab.app/p/carol/resource',
    });
    expect(result).toBe('Hey Carol, grab your guide at https://magnetlab.app/p/carol/resource');
  });

  it('handles empty name by rendering empty string', () => {
    const result = renderDmTemplate('Hi {{name}}!', {
      name: '',
      funnel_url: 'https://example.com',
    });
    expect(result).toBe('Hi !');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const result = renderDmTemplate('{{name}} — hey {{name}}!', {
      name: 'Dave',
      funnel_url: 'https://example.com',
    });
    expect(result).toBe('Dave — hey Dave!');
  });

  it('returns template unchanged when no placeholders present', () => {
    const result = renderDmTemplate('No placeholders here.', {
      name: 'Eve',
      funnel_url: 'https://example.com',
    });
    expect(result).toBe('No placeholders here.');
  });
});

// ─── validateCampaignInput ────────────────────────────────────────────────────

describe('validateCampaignInput', () => {
  const validInput = {
    name: 'My Campaign',
    post_url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789',
    keywords: ['interested', 'send it'],
    unipile_account_id: 'acc_123',
    dm_template: 'Hi {{name}}, here is your resource: {{funnel_url}}',
  };

  it('accepts valid input and normalizes the post URL', () => {
    const result = validateCampaignInput(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.post_url).toBe('urn:li:activity:7123456789');
    }
  });

  it('normalizes posts-style LinkedIn URL', () => {
    const result = validateCampaignInput({
      ...validInput,
      post_url: 'https://www.linkedin.com/posts/timkeen_gtm-now-runs-activity-7123456789-abcd',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.post_url).toBe('urn:li:activity:7123456789');
    }
  });

  it('rejects input with empty keywords array', () => {
    const result = validateCampaignInput({ ...validInput, keywords: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/keyword/i);
    }
  });

  it('rejects input with invalid post URL', () => {
    const result = validateCampaignInput({
      ...validInput,
      post_url: 'https://example.com/not-a-linkedin-post',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/url/i);
    }
  });

  it('rejects input with missing campaign name', () => {
    const result = validateCampaignInput({ ...validInput, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
    }
  });

  it('rejects input with missing DM template', () => {
    const result = validateCampaignInput({ ...validInput, dm_template: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
    }
  });

  it('rejects input with missing LinkedIn account ID', () => {
    const result = validateCampaignInput({ ...validInput, unipile_account_id: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
    }
  });
});
