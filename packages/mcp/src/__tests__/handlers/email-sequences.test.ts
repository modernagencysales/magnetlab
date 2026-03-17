import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEmailSequenceTools } from '../../handlers/email-sequences.js';
import type { MagnetLabClient } from '../../client.js';

// ── Mock data ─────────────────────────────────────────────

const MOCK_SEQUENCE_CLEAN = {
  emailSequence: {
    id: 'seq-1',
    status: 'draft',
    emails: [
      { day: 0, subject: 'Welcome to the guide', body: 'Here is your first tip about growth.' },
      { day: 3, subject: 'Tip #2: Advanced strategies', body: 'Let me share a real story.' },
    ],
  },
};

const MOCK_SEQUENCE_WITH_PLACEHOLDERS = {
  emailSequence: {
    id: 'seq-2',
    status: 'draft',
    emails: [
      { day: 0, subject: 'Welcome', body: 'Here is [INSERT TIP] for you.' },
      { day: 3, subject: '[YOUR NAME] check this', body: 'Download [Resource 1] now.' },
    ],
  },
};

const MOCK_SEQUENCE_EMPTY = {
  emailSequence: {
    id: 'seq-3',
    status: 'draft',
    emails: [],
  },
};

const MOCK_NO_SEQUENCE = { emailSequence: null };

const MOCK_ACTIVATE_RESULT = { emailSequence: { id: 'seq-1', status: 'active' } };

// ── Mock client factory ───────────────────────────────────

function createMockClient(overrides: Partial<MagnetLabClient> = {}) {
  return {
    getEmailSequence: vi.fn().mockResolvedValue(MOCK_SEQUENCE_CLEAN),
    generateEmailSequence: vi
      .fn()
      .mockResolvedValue({ emailSequence: MOCK_SEQUENCE_CLEAN, generated: true }),
    updateEmailSequence: vi.fn().mockResolvedValue(MOCK_SEQUENCE_CLEAN),
    activateEmailSequence: vi.fn().mockResolvedValue(MOCK_ACTIVATE_RESULT),
    ...overrides,
  } as unknown as MagnetLabClient;
}

// ── Placeholder validation tests ──────────────────────────

describe('handleEmailSequenceTools — activate validation', () => {
  it('activates successfully when emails have no placeholders', async () => {
    const client = createMockClient();

    const result = await handleEmailSequenceTools(
      'magnetlab_activate_email_sequence',
      { lead_magnet_id: 'lm-1' },
      client
    );

    expect(client.getEmailSequence).toHaveBeenCalledWith('lm-1');
    expect(client.activateEmailSequence).toHaveBeenCalledWith('lm-1');
    expect(result).toEqual(MOCK_ACTIVATE_RESULT);
  });

  it('rejects activation when emails contain [INSERT TIP] placeholder', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockResolvedValue(MOCK_SEQUENCE_WITH_PLACEHOLDERS),
    } as Partial<MagnetLabClient>);

    await expect(
      handleEmailSequenceTools(
        'magnetlab_activate_email_sequence',
        { lead_magnet_id: 'lm-2' },
        client
      )
    ).rejects.toThrow('Cannot activate');

    expect(client.activateEmailSequence).not.toHaveBeenCalled();
  });

  it('error message lists specific placeholder locations', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockResolvedValue(MOCK_SEQUENCE_WITH_PLACEHOLDERS),
    } as Partial<MagnetLabClient>);

    try {
      await handleEmailSequenceTools(
        'magnetlab_activate_email_sequence',
        { lead_magnet_id: 'lm-2' },
        client
      );
      expect.fail('Should have thrown');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('[INSERT TIP]');
      expect(msg).toContain('[YOUR NAME]');
      expect(msg).toContain('[Resource 1]');
      expect(msg).toContain('magnetlab_update_email_sequence');
    }
  });

  it('rejects activation when no sequence exists', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockResolvedValue(MOCK_NO_SEQUENCE),
    } as Partial<MagnetLabClient>);

    await expect(
      handleEmailSequenceTools(
        'magnetlab_activate_email_sequence',
        { lead_magnet_id: 'lm-3' },
        client
      )
    ).rejects.toThrow('No email sequence exists');

    expect(client.activateEmailSequence).not.toHaveBeenCalled();
  });

  it('rejects activation when sequence has no emails', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockResolvedValue(MOCK_SEQUENCE_EMPTY),
    } as Partial<MagnetLabClient>);

    await expect(
      handleEmailSequenceTools(
        'magnetlab_activate_email_sequence',
        { lead_magnet_id: 'lm-4' },
        client
      )
    ).rejects.toThrow('no emails');

    expect(client.activateEmailSequence).not.toHaveBeenCalled();
  });

  it('allows activation when brackets contain lowercase (not a placeholder)', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockResolvedValue({
        emailSequence: {
          id: 'seq-5',
          status: 'draft',
          emails: [{ day: 0, subject: 'Welcome', body: 'Check out [this link] for more.' }],
        },
      }),
    } as Partial<MagnetLabClient>);

    const result = await handleEmailSequenceTools(
      'magnetlab_activate_email_sequence',
      { lead_magnet_id: 'lm-5' },
      client
    );

    expect(client.activateEmailSequence).toHaveBeenCalledWith('lm-5');
    expect(result).toEqual(MOCK_ACTIVATE_RESULT);
  });
});

// ── Passthrough tests ─────────────────────────────────────

describe('handleEmailSequenceTools — passthrough calls', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('get passes lead_magnet_id to client', async () => {
    await handleEmailSequenceTools(
      'magnetlab_get_email_sequence',
      { lead_magnet_id: 'lm-1' },
      client
    );
    expect(client.getEmailSequence).toHaveBeenCalledWith('lm-1');
  });

  it('generate passes leadMagnetId and useAI', async () => {
    await handleEmailSequenceTools(
      'magnetlab_generate_email_sequence',
      { lead_magnet_id: 'lm-1', use_ai: false },
      client
    );
    expect(client.generateEmailSequence).toHaveBeenCalledWith({
      leadMagnetId: 'lm-1',
      useAI: false,
    });
  });

  it('update maps reply_trigger to replyTrigger', async () => {
    await handleEmailSequenceTools(
      'magnetlab_update_email_sequence',
      {
        lead_magnet_id: 'lm-1',
        emails: [{ day: 0, subject: 'Hi', body: 'Body', reply_trigger: 'welcome' }],
      },
      client
    );
    expect(client.updateEmailSequence).toHaveBeenCalledWith('lm-1', {
      emails: [{ day: 0, subject: 'Hi', body: 'Body', replyTrigger: 'welcome' }],
      status: undefined,
    });
  });

  it('throws on unknown tool name', async () => {
    await expect(handleEmailSequenceTools('magnetlab_unknown_tool', {}, client)).rejects.toThrow(
      'Unknown email sequence tool'
    );
  });
});
