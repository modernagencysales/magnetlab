/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import { registerAction, getAction, getToolDefinitions } from '@/lib/actions/registry';
import type { ActionContext } from '@/lib/actions/types';

const ctx: ActionContext = { scope: { type: 'user', userId: 'user-1' } };

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
    const tool = tools.find(t => t.name === 'test_action');
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
      handler: async () => { throw new Error('boom'); },
    });
    const result = await executeAction(ctx, 'broken_action', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });
});
