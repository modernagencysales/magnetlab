/** Tests for post campaign and account safety MCP tools. Covers tool definitions, handlers, client methods, and validation. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MagnetLabClient } from '../client.js';
import { handleToolCall } from '../handlers/index.js';
import { tools, toolsByName } from '../tools/index.js';
import { validateToolArgs } from '../validation.js';

// ─── Mock Fetch (for client tests) ──────────────────────────────────────────

let fetchCalls: Array<{
  url: string;
  method: string;
  body: unknown;
}> = [];

const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
  fetchCalls.push({
    url,
    method: init?.method || 'GET',
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ success: true }),
  };
});

vi.stubGlobal('fetch', mockFetch);

function lastCall() {
  return fetchCalls[fetchCalls.length - 1];
}

// ─── Mock Client (for handler tests) ────────────────────────────────────────

function createMockClient(): MagnetLabClient {
  const client = new MagnetLabClient('test-key');
  const methodNames = Object.getOwnPropertyNames(MagnetLabClient.prototype).filter(
    (n) => n !== 'constructor' && n !== 'request' && n !== 'aiRequest'
  );
  for (const method of methodNames) {
    (client as unknown as Record<string, unknown>)[method] = vi.fn().mockResolvedValue({
      mocked: true,
      method,
    });
  }
  return client;
}

async function callTool(client: MagnetLabClient, name: string, args: Record<string, unknown>) {
  const result = await handleToolCall(name, args, client);
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  return JSON.parse(result.content[0].text);
}

// ─── Tool Definition Tests ──────────────────────────────────────────────────

describe('Post Campaign Tool Definitions', () => {
  const campaignToolNames = [
    'magnetlab_list_post_campaigns',
    'magnetlab_create_post_campaign',
    'magnetlab_auto_setup_post_campaign',
    'magnetlab_get_post_campaign',
    'magnetlab_update_post_campaign',
    'magnetlab_activate_post_campaign',
    'magnetlab_pause_post_campaign',
    'magnetlab_delete_post_campaign',
  ];

  it('has 8 post campaign tools registered', () => {
    for (const name of campaignToolNames) {
      expect(toolsByName.has(name), `missing tool: ${name}`).toBe(true);
    }
  });

  it('all campaign tools have descriptions', () => {
    for (const name of campaignToolNames) {
      const tool = toolsByName.get(name)!;
      expect(tool.description, `${name} missing description`).toBeTruthy();
      expect(tool.description!.length, `${name} description too short`).toBeGreaterThan(10);
    }
  });

  it('all campaign tools have valid inputSchema', () => {
    for (const name of campaignToolNames) {
      const tool = toolsByName.get(name)!;
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema).toHaveProperty('properties');
    }
  });

  it('create_post_campaign has correct required fields', () => {
    const tool = toolsByName.get('magnetlab_create_post_campaign')!;
    const schema = tool.inputSchema as { required?: string[] };
    expect(schema.required).toContain('name');
    expect(schema.required).toContain('post_url');
    expect(schema.required).toContain('keywords');
    expect(schema.required).toContain('unipile_account_id');
    expect(schema.required).toContain('dm_template');
  });

  it('auto_setup_post_campaign requires post_id', () => {
    const tool = toolsByName.get('magnetlab_auto_setup_post_campaign')!;
    const schema = tool.inputSchema as { required?: string[] };
    expect(schema.required).toContain('post_id');
  });

  it('get/activate/pause/delete campaign tools require campaign_id', () => {
    const toolsWithCampaignId = [
      'magnetlab_get_post_campaign',
      'magnetlab_activate_post_campaign',
      'magnetlab_pause_post_campaign',
      'magnetlab_delete_post_campaign',
    ];
    for (const name of toolsWithCampaignId) {
      const tool = toolsByName.get(name)!;
      const schema = tool.inputSchema as { required?: string[] };
      expect(schema.required, `${name} missing required`).toContain('campaign_id');
    }
  });

  it('list_post_campaigns has optional status enum', () => {
    const tool = toolsByName.get('magnetlab_list_post_campaigns')!;
    const props = (tool.inputSchema as { properties: Record<string, unknown> }).properties;
    const statusProp = props.status as { enum?: string[] };
    expect(statusProp.enum).toEqual(['draft', 'active', 'paused', 'completed']);
  });
});

describe('Account Safety Tool Definitions', () => {
  const safetyToolNames = [
    'magnetlab_get_account_safety_settings',
    'magnetlab_update_account_safety_settings',
  ];

  it('has 2 account safety tools registered', () => {
    for (const name of safetyToolNames) {
      expect(toolsByName.has(name), `missing tool: ${name}`).toBe(true);
    }
  });

  it('both safety tools require unipile_account_id', () => {
    for (const name of safetyToolNames) {
      const tool = toolsByName.get(name)!;
      const schema = tool.inputSchema as { required?: string[] };
      expect(schema.required).toContain('unipile_account_id');
    }
  });

  it('update tool has all safety settings fields', () => {
    const tool = toolsByName.get('magnetlab_update_account_safety_settings')!;
    const props = Object.keys(
      (tool.inputSchema as { properties: Record<string, unknown> }).properties
    );
    expect(props).toContain('max_dms_per_day');
    expect(props).toContain('max_connection_requests_per_day');
    expect(props).toContain('operating_hours_start');
    expect(props).toContain('operating_hours_end');
    expect(props).toContain('timezone');
  });
});

describe('Updated create_post tool', () => {
  it('has image_url, is_lead_magnet_post, and auto_activate properties', () => {
    const tool = toolsByName.get('magnetlab_create_post')!;
    const props = Object.keys(
      (tool.inputSchema as { properties: Record<string, unknown> }).properties
    );
    expect(props).toContain('image_url');
    expect(props).toContain('is_lead_magnet_post');
    expect(props).toContain('auto_activate');
  });
});

// ─── Validation Tests ───────────────────────────────────────────────────────

describe('Post Campaign Validation', () => {
  describe('magnetlab_list_post_campaigns', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_list_post_campaigns', {});
      expect(result).toBeDefined();
    });

    it('accepts valid status filter', () => {
      const result = validateToolArgs('magnetlab_list_post_campaigns', { status: 'active' });
      expect(result).toMatchObject({ status: 'active' });
    });

    it('rejects invalid status', () => {
      expect(() =>
        validateToolArgs('magnetlab_list_post_campaigns', { status: 'invalid' })
      ).toThrow();
    });
  });

  describe('magnetlab_create_post_campaign', () => {
    const validInput = {
      name: 'My Campaign',
      post_url: 'https://www.linkedin.com/posts/test-12345',
      keywords: ['guide', 'send'],
      unipile_account_id: 'acc-123',
      dm_template: 'Hey {{first_name}}, here is your guide: {{funnel_url}}',
    };

    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_create_post_campaign', validInput);
      expect(result).toMatchObject({ name: 'My Campaign' });
    });

    it('accepts all optional fields', () => {
      const result = validateToolArgs('magnetlab_create_post_campaign', {
        ...validInput,
        funnel_page_id: 'fp-1',
        reply_template: 'Thanks for commenting!',
        poster_account_id: 'poster-1',
        target_locations: ['US', 'UK'],
        auto_accept_connections: true,
        auto_like_comments: true,
        auto_connect_non_requesters: false,
      });
      expect(result).toMatchObject({
        funnel_page_id: 'fp-1',
        auto_accept_connections: true,
      });
    });

    it('rejects missing name', () => {
      const { name, ...rest } = validInput;
      expect(() => validateToolArgs('magnetlab_create_post_campaign', rest)).toThrow();
    });

    it('rejects invalid post_url', () => {
      expect(() =>
        validateToolArgs('magnetlab_create_post_campaign', {
          ...validInput,
          post_url: 'not-a-url',
        })
      ).toThrow();
    });

    it('rejects empty keywords array', () => {
      expect(() =>
        validateToolArgs('magnetlab_create_post_campaign', {
          ...validInput,
          keywords: [],
        })
      ).toThrow();
    });

    it('rejects missing dm_template', () => {
      const { dm_template, ...rest } = validInput;
      expect(() => validateToolArgs('magnetlab_create_post_campaign', rest)).toThrow();
    });
  });

  describe('magnetlab_auto_setup_post_campaign', () => {
    it('accepts valid post_id', () => {
      const result = validateToolArgs('magnetlab_auto_setup_post_campaign', {
        post_id: 'post-abc',
      });
      expect(result).toMatchObject({ post_id: 'post-abc' });
    });

    it('rejects missing post_id', () => {
      expect(() => validateToolArgs('magnetlab_auto_setup_post_campaign', {})).toThrow();
    });
  });

  describe('magnetlab_get_post_campaign', () => {
    it('accepts valid campaign_id', () => {
      const result = validateToolArgs('magnetlab_get_post_campaign', { campaign_id: 'camp-1' });
      expect(result).toMatchObject({ campaign_id: 'camp-1' });
    });

    it('rejects missing campaign_id', () => {
      expect(() => validateToolArgs('magnetlab_get_post_campaign', {})).toThrow();
    });
  });

  describe('magnetlab_update_post_campaign', () => {
    it('accepts campaign_id with optional fields', () => {
      const result = validateToolArgs('magnetlab_update_post_campaign', {
        campaign_id: 'camp-1',
        name: 'Updated Name',
        auto_like_comments: true,
      });
      expect(result).toMatchObject({ campaign_id: 'camp-1', name: 'Updated Name' });
    });

    it('accepts nullable funnel_page_id', () => {
      const result = validateToolArgs('magnetlab_update_post_campaign', {
        campaign_id: 'camp-1',
        funnel_page_id: null,
      });
      expect(result).toMatchObject({ funnel_page_id: null });
    });

    it('rejects missing campaign_id', () => {
      expect(() => validateToolArgs('magnetlab_update_post_campaign', { name: 'x' })).toThrow();
    });
  });

  describe('magnetlab_activate_post_campaign', () => {
    it('accepts valid campaign_id', () => {
      const result = validateToolArgs('magnetlab_activate_post_campaign', {
        campaign_id: 'camp-1',
      });
      expect(result).toMatchObject({ campaign_id: 'camp-1' });
    });
  });

  describe('magnetlab_pause_post_campaign', () => {
    it('accepts valid campaign_id', () => {
      const result = validateToolArgs('magnetlab_pause_post_campaign', { campaign_id: 'camp-1' });
      expect(result).toMatchObject({ campaign_id: 'camp-1' });
    });
  });

  describe('magnetlab_delete_post_campaign', () => {
    it('accepts valid campaign_id', () => {
      const result = validateToolArgs('magnetlab_delete_post_campaign', {
        campaign_id: 'camp-1',
      });
      expect(result).toMatchObject({ campaign_id: 'camp-1' });
    });
  });
});

describe('Account Safety Validation', () => {
  describe('magnetlab_get_account_safety_settings', () => {
    it('accepts valid unipile_account_id', () => {
      const result = validateToolArgs('magnetlab_get_account_safety_settings', {
        unipile_account_id: 'acc-123',
      });
      expect(result).toMatchObject({ unipile_account_id: 'acc-123' });
    });

    it('rejects missing unipile_account_id', () => {
      expect(() => validateToolArgs('magnetlab_get_account_safety_settings', {})).toThrow();
    });
  });

  describe('magnetlab_update_account_safety_settings', () => {
    it('accepts unipile_account_id with optional settings', () => {
      const result = validateToolArgs('magnetlab_update_account_safety_settings', {
        unipile_account_id: 'acc-123',
        max_dms_per_day: 20,
        operating_hours_start: '09:00',
        operating_hours_end: '17:00',
        timezone: 'America/New_York',
      });
      expect(result).toMatchObject({ max_dms_per_day: 20 });
    });

    it('rejects negative numeric value', () => {
      expect(() =>
        validateToolArgs('magnetlab_update_account_safety_settings', {
          unipile_account_id: 'acc-123',
          max_dms_per_day: -1,
        })
      ).toThrow();
    });

    it('rejects invalid time format', () => {
      expect(() =>
        validateToolArgs('magnetlab_update_account_safety_settings', {
          unipile_account_id: 'acc-123',
          operating_hours_start: '25:00',
        })
      ).toThrow();
    });

    it('accepts valid HH:MM format', () => {
      const result = validateToolArgs('magnetlab_update_account_safety_settings', {
        unipile_account_id: 'acc-123',
        operating_hours_start: '08:30',
        operating_hours_end: '23:59',
      });
      expect(result).toMatchObject({
        operating_hours_start: '08:30',
        operating_hours_end: '23:59',
      });
    });
  });
});

describe('Updated create_post validation', () => {
  it('accepts new optional fields', () => {
    const result = validateToolArgs('magnetlab_create_post', {
      body: 'My post about a guide',
      image_url: 'https://example.com/img.png',
      is_lead_magnet_post: true,
      auto_activate: true,
    });
    expect(result).toMatchObject({
      image_url: 'https://example.com/img.png',
      is_lead_magnet_post: true,
      auto_activate: true,
    });
  });

  it('rejects invalid image_url', () => {
    expect(() =>
      validateToolArgs('magnetlab_create_post', {
        body: 'My post',
        image_url: 'not-a-url',
      })
    ).toThrow();
  });
});

// ─── Handler Tests ──────────────────────────────────────────────────────────

describe('Post Campaign Handler Routing', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('magnetlab_list_post_campaigns passes status filter', async () => {
    await callTool(client, 'magnetlab_list_post_campaigns', { status: 'active' });
    expect(client.listPostCampaigns).toHaveBeenCalledWith('active');
  });

  it('magnetlab_list_post_campaigns works without filter', async () => {
    await callTool(client, 'magnetlab_list_post_campaigns', {});
    expect(client.listPostCampaigns).toHaveBeenCalledWith(undefined);
  });

  it('magnetlab_create_post_campaign passes all fields', async () => {
    await callTool(client, 'magnetlab_create_post_campaign', {
      name: 'My Campaign',
      post_url: 'https://linkedin.com/posts/test',
      keywords: ['guide'],
      unipile_account_id: 'acc-1',
      dm_template: 'Hey {{first_name}}',
      funnel_page_id: 'fp-1',
      auto_like_comments: true,
    });
    expect(client.createPostCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Campaign',
        keywords: ['guide'],
        funnel_page_id: 'fp-1',
        auto_like_comments: true,
      })
    );
  });

  it('magnetlab_auto_setup_post_campaign passes post_id', async () => {
    await callTool(client, 'magnetlab_auto_setup_post_campaign', { post_id: 'post-1' });
    expect(client.autoSetupPostCampaign).toHaveBeenCalledWith('post-1');
  });

  it('magnetlab_get_post_campaign passes campaign_id', async () => {
    await callTool(client, 'magnetlab_get_post_campaign', { campaign_id: 'camp-1' });
    expect(client.getPostCampaign).toHaveBeenCalledWith('camp-1');
  });

  it('magnetlab_update_post_campaign passes campaign_id and updates', async () => {
    await callTool(client, 'magnetlab_update_post_campaign', {
      campaign_id: 'camp-1',
      name: 'Updated',
      auto_like_comments: false,
    });
    expect(client.updatePostCampaign).toHaveBeenCalledWith('camp-1', {
      name: 'Updated',
      auto_like_comments: false,
    });
  });

  it('magnetlab_activate_post_campaign passes campaign_id', async () => {
    await callTool(client, 'magnetlab_activate_post_campaign', { campaign_id: 'camp-1' });
    expect(client.activatePostCampaign).toHaveBeenCalledWith('camp-1');
  });

  it('magnetlab_pause_post_campaign passes campaign_id', async () => {
    await callTool(client, 'magnetlab_pause_post_campaign', { campaign_id: 'camp-1' });
    expect(client.pausePostCampaign).toHaveBeenCalledWith('camp-1');
  });

  it('magnetlab_delete_post_campaign passes campaign_id', async () => {
    await callTool(client, 'magnetlab_delete_post_campaign', { campaign_id: 'camp-1' });
    expect(client.deletePostCampaign).toHaveBeenCalledWith('camp-1');
  });
});

describe('Account Safety Handler Routing', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('magnetlab_get_account_safety_settings passes account id', async () => {
    await callTool(client, 'magnetlab_get_account_safety_settings', {
      unipile_account_id: 'acc-1',
    });
    expect(client.getAccountSafetySettings).toHaveBeenCalledWith('acc-1');
  });

  it('magnetlab_update_account_safety_settings transforms snake_case to camelCase', async () => {
    await callTool(client, 'magnetlab_update_account_safety_settings', {
      unipile_account_id: 'acc-1',
      max_dms_per_day: 20,
      max_connection_requests_per_day: 10,
      operating_hours_start: '09:00',
      operating_hours_end: '17:00',
      timezone: 'America/New_York',
    });
    expect(client.updateAccountSafetySettings).toHaveBeenCalledWith('acc-1', {
      maxDmsPerDay: 20,
      maxConnectionRequestsPerDay: 10,
      operatingHoursStart: '09:00',
      operatingHoursEnd: '17:00',
      timezone: 'America/New_York',
    });
  });

  it('magnetlab_update_account_safety_settings omits unset fields', async () => {
    await callTool(client, 'magnetlab_update_account_safety_settings', {
      unipile_account_id: 'acc-1',
      max_dms_per_day: 15,
    });
    expect(client.updateAccountSafetySettings).toHaveBeenCalledWith('acc-1', {
      maxDmsPerDay: 15,
    });
  });
});

describe('Updated create_post handler', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('passes image_url, is_lead_magnet_post, auto_activate to client', async () => {
    await callTool(client, 'magnetlab_create_post', {
      body: 'My post',
      image_url: 'https://example.com/img.png',
      is_lead_magnet_post: true,
      auto_activate: true,
    });
    expect(client.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'My post',
        image_url: 'https://example.com/img.png',
        is_lead_magnet_post: true,
        auto_activate: true,
      })
    );
  });
});

// ─── Client Method Tests ────────────────────────────────────────────────────

describe('Post Campaign Client Methods', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    fetchCalls = [];
    mockFetch.mockClear();
    client = new MagnetLabClient('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listPostCampaigns uses GET with optional status', async () => {
    await client.listPostCampaigns('active');
    expect(lastCall().method).toBe('GET');
    expect(lastCall().url).toContain('/post-campaigns');
    expect(lastCall().url).toContain('status=active');
  });

  it('listPostCampaigns without status has no query string', async () => {
    await client.listPostCampaigns();
    expect(lastCall().url).toMatch(/\/post-campaigns$/);
  });

  it('createPostCampaign uses POST', async () => {
    await client.createPostCampaign({ name: 'Test', post_url: 'https://linkedin.com/posts/x' });
    expect(lastCall().method).toBe('POST');
    expect(lastCall().url).toContain('/post-campaigns');
    expect(lastCall().body).toMatchObject({ name: 'Test' });
  });

  it('autoSetupPostCampaign uses POST with post_id', async () => {
    await client.autoSetupPostCampaign('post-abc');
    expect(lastCall().method).toBe('POST');
    expect(lastCall().url).toContain('/post-campaigns/auto-setup');
    expect(lastCall().body).toEqual({ post_id: 'post-abc' });
  });

  it('getPostCampaign uses GET with id in path', async () => {
    await client.getPostCampaign('camp-1');
    expect(lastCall().method).toBe('GET');
    expect(lastCall().url).toContain('/post-campaigns/camp-1');
  });

  it('updatePostCampaign uses PATCH with id in path', async () => {
    await client.updatePostCampaign('camp-1', { name: 'Updated' });
    expect(lastCall().method).toBe('PATCH');
    expect(lastCall().url).toContain('/post-campaigns/camp-1');
    expect(lastCall().body).toEqual({ name: 'Updated' });
  });

  it('activatePostCampaign uses POST with id/activate path', async () => {
    await client.activatePostCampaign('camp-1');
    expect(lastCall().method).toBe('POST');
    expect(lastCall().url).toContain('/post-campaigns/camp-1/activate');
  });

  it('pausePostCampaign uses POST with id/pause path', async () => {
    await client.pausePostCampaign('camp-1');
    expect(lastCall().method).toBe('POST');
    expect(lastCall().url).toContain('/post-campaigns/camp-1/pause');
  });

  it('deletePostCampaign uses DELETE with id in path', async () => {
    await client.deletePostCampaign('camp-1');
    expect(lastCall().method).toBe('DELETE');
    expect(lastCall().url).toContain('/post-campaigns/camp-1');
  });
});

describe('Account Safety Client Methods', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    fetchCalls = [];
    mockFetch.mockClear();
    client = new MagnetLabClient('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getAccountSafetySettings uses GET with accountId in path', async () => {
    await client.getAccountSafetySettings('acc-123');
    expect(lastCall().method).toBe('GET');
    expect(lastCall().url).toContain('/account-safety-settings/acc-123');
  });

  it('updateAccountSafetySettings uses PATCH with accountId in path', async () => {
    await client.updateAccountSafetySettings('acc-123', {
      maxDmsPerDay: 20,
      operatingHoursStart: '09:00',
    });
    expect(lastCall().method).toBe('PATCH');
    expect(lastCall().url).toContain('/account-safety-settings/acc-123');
    expect(lastCall().body).toEqual({
      maxDmsPerDay: 20,
      operatingHoursStart: '09:00',
    });
  });
});
