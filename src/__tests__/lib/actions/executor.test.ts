/**
 * @jest-environment node
 */

jest.mock('@/lib/utils/logger');

import { executeAction } from '@/lib/actions/executor';
import { registerAction, getAction, getToolDefinitions } from '@/lib/actions/registry';
import { logError } from '@/lib/utils/logger';
import type { ActionContext } from '@/lib/actions/types';

const ctx: ActionContext = { userId: 'user-1' };

describe('Action Registry', () => {
  beforeAll(() => {
    registerAction({
      name: 'test_action',
      description: 'A test action',
      parameters: { properties: { query: { type: 'string' } }, required: ['query'] },
      handler: async (_ctx, params: { query: string }) => ({
        success: true,
        data: { echo: params.query },
        displayHint: 'text' as const,
      }),
    });
  });

  it('registers and retrieves actions', () => {
    const action = getAction('test_action');
    expect(action).toBeDefined();
    expect(action!.name).toBe('test_action');
  });

  it('exports tool definitions in Claude format', () => {
    const tools = getToolDefinitions();
    expect(tools.length).toBeGreaterThan(0);
    const tool = tools.find((t) => t.name === 'test_action');
    expect(tool).toBeDefined();
    expect(tool!.input_schema.type).toBe('object');
  });
});

describe('Action Executor', () => {
  it('executes a registered action', async () => {
    const result = await executeAction(ctx, 'test_action', { query: 'hello' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ echo: 'hello' });
  });

  it('returns error for unknown action', async () => {
    const result = await executeAction(ctx, 'nonexistent', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });

  it('catches handler errors', async () => {
    registerAction({
      name: 'broken_action',
      description: 'Throws',
      parameters: {},
      handler: async () => {
        throw new Error('boom');
      },
    });
    const result = await executeAction(ctx, 'broken_action', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });
});

// ─── Retry & Timeout Tests ──────────────────────────────

describe('Action Executor — Retry & Timeout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('times out and returns error when action exceeds timeout', async () => {
    registerAction({
      name: 'slow_action',
      description: 'Takes forever',
      parameters: {},
      handler: async () =>
        new Promise((resolve) => setTimeout(() => resolve({ success: true }), 5000)),
    });

    const result = await executeAction(ctx, 'slow_action', {}, { timeoutMs: 100, noRetry: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('retries on transient ECONNRESET errors', async () => {
    let callCount = 0;
    registerAction({
      name: 'flaky_action',
      description: 'Flaky',
      parameters: {},
      handler: async () => {
        callCount++;
        if (callCount === 1) throw new Error('ECONNRESET');
        return { success: true, data: 'recovered' };
      },
    });

    const result = await executeAction(ctx, 'flaky_action', {}, { maxRetries: 1 });

    expect(result.success).toBe(true);
    expect(result.data).toBe('recovered');
    expect(callCount).toBe(2);
  });

  it('retries on rate limit errors', async () => {
    let callCount = 0;
    registerAction({
      name: 'rate_limited_action',
      description: 'Rate limited',
      parameters: {},
      handler: async () => {
        callCount++;
        if (callCount === 1) throw new Error('429 Too Many Requests');
        return { success: true };
      },
    });

    const result = await executeAction(ctx, 'rate_limited_action', {}, { maxRetries: 1 });

    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
  });

  it('does NOT retry non-transient business errors', async () => {
    let callCount = 0;
    registerAction({
      name: 'bad_input_action',
      description: 'Bad input',
      parameters: {},
      handler: async () => {
        callCount++;
        throw new Error('Invalid input: missing field');
      },
    });

    const result = await executeAction(ctx, 'bad_input_action', {}, { maxRetries: 2 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid input');
    expect(callCount).toBe(1);
  });

  it('returns error after exhausting retries', async () => {
    registerAction({
      name: 'always_fails_action',
      description: 'Always fails',
      parameters: {},
      handler: async () => {
        throw new Error('ECONNRESET');
      },
    });

    const result = await executeAction(ctx, 'always_fails_action', {}, { maxRetries: 2 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNRESET');
    expect(logError).toHaveBeenCalledWith(
      'action-executor',
      expect.any(Error),
      expect.objectContaining({ exhaustedRetries: true })
    );
  });

  it('skips retries when noRetry option is set', async () => {
    let callCount = 0;
    registerAction({
      name: 'no_retry_action',
      description: 'No retry',
      parameters: {},
      handler: async () => {
        callCount++;
        throw new Error('ECONNRESET');
      },
    });

    const result = await executeAction(ctx, 'no_retry_action', {}, { noRetry: true });

    expect(result.success).toBe(false);
    expect(callCount).toBe(1);
  });
});
