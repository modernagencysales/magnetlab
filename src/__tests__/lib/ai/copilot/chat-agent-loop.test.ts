/**
 * @jest-environment node
 */

import type { AgentLoopOptions, AgentLoopResult } from '@/lib/ai/copilot/chat-agent-loop';

describe('chat-agent-loop types', () => {
  it('exports AgentLoopOptions interface', () => {
    const options: AgentLoopOptions = {
      systemPrompt: 'test',
      tools: [],
      initialMessages: [],
      conversationId: 'conv-1',
      userId: 'user-1',
      actionCtx: { userId: 'user-1' },
      cachedEnrollmentCheck: null,
      send: jest.fn(),
    };
    expect(options.maxIterations).toBeUndefined();
  });

  it('AgentLoopResult has iterations field', () => {
    const result: AgentLoopResult = { iterations: 3 };
    expect(result.iterations).toBe(3);
  });
});
