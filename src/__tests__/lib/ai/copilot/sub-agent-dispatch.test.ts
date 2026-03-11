/**
 * @jest-environment node
 */

const mockOn = jest.fn();
const mockFinalMessage = jest.fn();
const mockStreamFn = jest.fn(() => ({ on: mockOn, finalMessage: mockFinalMessage }));

jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(() => ({
    messages: {
      stream: mockStreamFn,
    },
  })),
}));

jest.mock('@/lib/actions', () => ({
  executeAction: jest.fn().mockResolvedValue({ success: true, data: {} }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { dispatchSubAgent, parseHandoff } from '@/lib/ai/copilot/sub-agent-dispatch';
import type { SubAgentConfig, SSESender } from '@/lib/ai/copilot/sub-agent-dispatch';
import type { ActionContext } from '@/lib/actions';
import { executeAction } from '@/lib/actions';
import type { SubAgentHandoff } from '@/lib/types/accelerator';

const mockSend: SSESender = jest.fn();
const actionCtx: ActionContext = { userId: 'u1' };

const baseConfig: SubAgentConfig = {
  type: 'icp',
  systemPrompt: 'You are the ICP specialist.',
  tools: [],
  contextSummary: 'User needs help defining ICP.',
  userMessage: 'Help me define my ICP.',
};

describe('dispatchSubAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: text response, no tools, end_turn
    mockOn.mockImplementation((event: string, cb: (text: string) => void) => {
      if (event === 'text') {
        cb('Here is your ICP definition.');
      }
    });
    mockFinalMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'Here is your ICP definition.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  });

  it('sends sub_agent_start and sub_agent_end events', async () => {
    await dispatchSubAgent(baseConfig, actionCtx, mockSend);

    expect(mockSend).toHaveBeenCalledWith(
      'sub_agent_start',
      expect.objectContaining({ type: 'icp' })
    );
    expect(mockSend).toHaveBeenCalledWith(
      'sub_agent_end',
      expect.objectContaining({ type: 'icp' })
    );
  });

  it('sends correct label for each sub-agent type', async () => {
    await dispatchSubAgent(baseConfig, actionCtx, mockSend);
    expect(mockSend).toHaveBeenCalledWith('sub_agent_start', {
      type: 'icp',
      message: 'Bringing in the ICP & Positioning specialist...',
    });

    jest.clearAllMocks();
    mockOn.mockImplementation((event: string, cb: (text: string) => void) => {
      if (event === 'text') cb('content help');
    });
    mockFinalMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'content help' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    await dispatchSubAgent({ ...baseConfig, type: 'content' }, actionCtx, mockSend);
    expect(mockSend).toHaveBeenCalledWith('sub_agent_start', {
      type: 'content',
      message: 'Bringing in the Content Engine specialist...',
    });
  });

  it('forwards text deltas through sendSSE', async () => {
    await dispatchSubAgent(baseConfig, actionCtx, mockSend);

    expect(mockSend).toHaveBeenCalledWith(
      'text_delta',
      expect.objectContaining({ text: expect.any(String) })
    );
  });

  it('returns handoff with summary from plain text', async () => {
    const handoff = await dispatchSubAgent(baseConfig, actionCtx, mockSend);

    expect(handoff.summary).toBeTruthy();
    expect(handoff.needs_escalation).toBe(false);
    expect(handoff.deliverables_created).toEqual([]);
    expect(handoff.progress_updates).toEqual([]);
    expect(handoff.validation_results).toEqual([]);
  });

  it('handles API errors gracefully', async () => {
    mockFinalMessage.mockRejectedValue(new Error('API timeout'));

    const handoff = await dispatchSubAgent(baseConfig, actionCtx, mockSend);

    expect(handoff.needs_escalation).toBe(true);
    expect(handoff.summary).toContain('error');
    expect(mockSend).toHaveBeenCalledWith(
      'sub_agent_end',
      expect.objectContaining({ error: true })
    );
  });

  it('parses structured JSON handoff from text', async () => {
    const handoffJson = JSON.stringify({
      deliverables_created: [{ type: 'icp_definition', entity_id: 'e1' }],
      progress_updates: [{ module_id: 'm0', step: 'caroline-done' }],
      validation_results: [],
      needs_escalation: false,
      summary: 'ICP defined successfully.',
    });

    const responseText = 'Done! Here is the handoff:\n```json\n' + handoffJson + '\n```';

    mockOn.mockImplementation((event: string, cb: (text: string) => void) => {
      if (event === 'text') {
        cb(responseText);
      }
    });
    mockFinalMessage.mockResolvedValue({
      content: [{ type: 'text', text: responseText }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const handoff = await dispatchSubAgent(baseConfig, actionCtx, mockSend);

    expect(handoff.deliverables_created).toHaveLength(1);
    expect(handoff.deliverables_created[0].type).toBe('icp_definition');
    expect(handoff.progress_updates).toHaveLength(1);
    expect(handoff.summary).toBe('ICP defined successfully.');
    expect(handoff.needs_escalation).toBe(false);
  });

  it('executes tool calls and continues the loop', async () => {
    // First iteration: tool use
    let callCount = 0;
    mockOn.mockImplementation((event: string, cb: (text: string) => void) => {
      if (event === 'text' && callCount > 0) {
        cb('Final response after tool use.');
      }
    });
    mockFinalMessage
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'get_program_state',
            input: {},
          },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 50, output_tokens: 30 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Final response after tool use.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 80, output_tokens: 40 },
      });

    // Track mock calls to know which iteration we're in
    mockStreamFn.mockImplementation(() => {
      callCount++;
      return { on: mockOn, finalMessage: mockFinalMessage };
    });

    await dispatchSubAgent(baseConfig, actionCtx, mockSend);

    // Should have called executeAction for the tool
    expect(executeAction).toHaveBeenCalledWith(actionCtx, 'get_program_state', {});

    // Should have sent tool_call and tool_result SSE events
    expect(mockSend).toHaveBeenCalledWith(
      'tool_call',
      expect.objectContaining({ name: 'get_program_state', subAgent: 'icp' })
    );
    expect(mockSend).toHaveBeenCalledWith(
      'tool_result',
      expect.objectContaining({ name: 'get_program_state', subAgent: 'icp' })
    );
  });

  it('respects max iterations limit', async () => {
    // Always return tool_use with stop_reason tool_use (never end_turn)
    mockFinalMessage.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tu_loop', name: 'some_tool', input: {} }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    await dispatchSubAgent(baseConfig, actionCtx, mockSend);

    // Should have called stream exactly 10 times (SUB_AGENT_MAX_ITERATIONS)
    expect(mockStreamFn).toHaveBeenCalledTimes(10);
  });
});

describe('parseHandoff', () => {
  const defaultHandoff: SubAgentHandoff = {
    deliverables_created: [],
    progress_updates: [],
    validation_results: [],
    needs_escalation: false,
    summary: '',
  };

  it('extracts JSON from code block', () => {
    const text =
      'Here is your result:\n```json\n{"summary":"Done","deliverables_created":[],"progress_updates":[],"validation_results":[],"needs_escalation":false}\n```';
    const result = parseHandoff(text, defaultHandoff);
    expect(result.summary).toBe('Done');
  });

  it('falls back to text truncation when no JSON block', () => {
    const text = 'This is a plain text response with no JSON block.';
    const result = parseHandoff(text, defaultHandoff);
    expect(result.summary).toBe(text);
    expect(result.needs_escalation).toBe(false);
  });

  it('falls back when JSON is malformed', () => {
    const text = '```json\n{broken json\n```';
    const result = parseHandoff(text, defaultHandoff);
    expect(result.summary).toBe(text.slice(0, 500));
  });

  it('truncates long text summaries to 500 chars', () => {
    const text = 'a'.repeat(1000);
    const result = parseHandoff(text, defaultHandoff);
    expect(result.summary).toHaveLength(500);
  });

  it('fills missing fields with defaults', () => {
    const text = '```json\n{"summary":"partial"}\n```';
    const result = parseHandoff(text, defaultHandoff);
    expect(result.summary).toBe('partial');
    expect(result.deliverables_created).toEqual([]);
    expect(result.progress_updates).toEqual([]);
    expect(result.validation_results).toEqual([]);
    expect(result.needs_escalation).toBe(false);
  });
});
