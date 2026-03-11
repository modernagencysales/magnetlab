/**
 * @jest-environment node
 */

jest.mock('@/lib/actions', () => ({
  getToolDefinitions: () => [{ name: 'get_program_state', description: 'test', input_schema: {} }],
}));

import { buildChatTools } from '@/lib/ai/copilot/chat-tools';

describe('buildChatTools', () => {
  it('includes base tools plus dispatch_sub_agent', () => {
    const tools = buildChatTools();
    expect(tools.length).toBeGreaterThan(1);
    expect(tools.find((t) => t.name === 'dispatch_sub_agent')).toBeDefined();
    expect(tools.find((t) => t.name === 'get_program_state')).toBeDefined();
  });

  it('dispatch_sub_agent has required schema properties', () => {
    const tools = buildChatTools();
    const dispatch = tools.find((t) => t.name === 'dispatch_sub_agent');
    const props = (dispatch?.input_schema as Record<string, unknown>).properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('agent_type');
    expect(props).toHaveProperty('context');
    expect(props).toHaveProperty('user_message');
  });

  it('dispatch_sub_agent lists all expected agent_type enum values', () => {
    const tools = buildChatTools();
    const dispatch = tools.find((t) => t.name === 'dispatch_sub_agent');
    const agentType = (
      (dispatch?.input_schema as Record<string, unknown>).properties as Record<
        string,
        { enum?: string[] }
      >
    ).agent_type;
    expect(agentType.enum).toEqual([
      'icp',
      'lead_magnet',
      'content',
      'troubleshooter',
      'tam',
      'outreach',
      'linkedin_ads',
      'operating_system',
    ]);
  });

  it('dispatch_sub_agent marks agent_type, context, user_message as required', () => {
    const tools = buildChatTools();
    const dispatch = tools.find((t) => t.name === 'dispatch_sub_agent');
    const required = (dispatch?.input_schema as Record<string, unknown>).required as string[];
    expect(required).toContain('agent_type');
    expect(required).toContain('context');
    expect(required).toContain('user_message');
  });

  it('dispatch_sub_agent is appended after base tools', () => {
    const tools = buildChatTools();
    expect(tools[tools.length - 1].name).toBe('dispatch_sub_agent');
  });
});
