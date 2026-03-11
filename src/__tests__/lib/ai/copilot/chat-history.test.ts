/**
 * @jest-environment node
 */

import { buildClaudeMessages } from '@/lib/ai/copilot/chat-history';
import type { DbMessage } from '@/lib/ai/copilot/chat-history';

// ─── Helpers ─────────────────────────────────────────────

function makeMsg(overrides: Partial<DbMessage> & { id: string; role: string }): DbMessage {
  return {
    content: null,
    tool_name: null,
    tool_args: null,
    tool_result: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('buildClaudeMessages', () => {
  it('returns empty array for empty history', () => {
    expect(buildClaudeMessages([])).toEqual([]);
  });

  it('converts user messages', () => {
    const history: DbMessage[] = [makeMsg({ id: 'a1', role: 'user', content: 'Hello there' })];
    const result = buildClaudeMessages(history);
    expect(result).toEqual([{ role: 'user', content: 'Hello there' }]);
  });

  it('converts assistant messages', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'b1', role: 'assistant', content: 'How can I help?' }),
    ];
    const result = buildClaudeMessages(history);
    expect(result).toEqual([{ role: 'assistant', content: 'How can I help?' }]);
  });

  it('handles null content gracefully (falls back to empty string)', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'c1', role: 'user', content: null }),
      makeMsg({ id: 'c2', role: 'assistant', content: null }),
    ];
    const result = buildClaudeMessages(history);
    expect(result).toEqual([
      { role: 'user', content: '' },
      { role: 'assistant', content: '' },
    ]);
  });

  it('pairs a single tool_call with its tool_result using deterministic IDs', () => {
    const history: DbMessage[] = [
      makeMsg({
        id: 'msg-uuid-1',
        role: 'tool_call',
        tool_name: 'create_post',
        tool_args: { text: 'Hello' },
      }),
      makeMsg({ id: 'msg-uuid-2', role: 'tool_result', tool_result: { success: true } }),
    ];
    const result = buildClaudeMessages(history);

    expect(result).toHaveLength(2);

    // Assistant block with tool_use
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toEqual([
      {
        type: 'tool_use',
        id: 'tool_msg-uuid-1',
        name: 'create_post',
        input: { text: 'Hello' },
      },
    ]);

    // User block with tool_result referencing the same deterministic ID
    expect(result[1].role).toBe('user');
    expect(result[1].content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'tool_msg-uuid-1',
        content: JSON.stringify({ success: true }),
      },
    ]);
  });

  it('groups consecutive tool_call + tool_result pairs into one assistant and one user message', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'tc-1', role: 'tool_call', tool_name: 'action_a', tool_args: { x: 1 } }),
      makeMsg({ id: 'tr-1', role: 'tool_result', tool_result: { data: 'result_a' } }),
      makeMsg({ id: 'tc-2', role: 'tool_call', tool_name: 'action_b', tool_args: { y: 2 } }),
      makeMsg({ id: 'tr-2', role: 'tool_result', tool_result: { data: 'result_b' } }),
    ];
    const result = buildClaudeMessages(history);

    // Both tool_calls collapsed into one assistant message
    expect(result).toHaveLength(2);

    expect(result[0].role).toBe('assistant');
    const useBlocks = result[0].content as Array<Record<string, unknown>>;
    expect(useBlocks).toHaveLength(2);
    expect(useBlocks[0]).toMatchObject({ type: 'tool_use', id: 'tool_tc-1', name: 'action_a' });
    expect(useBlocks[1]).toMatchObject({ type: 'tool_use', id: 'tool_tc-2', name: 'action_b' });

    // Both tool_results collapsed into one user message
    expect(result[1].role).toBe('user');
    const resultBlocks = result[1].content as Array<Record<string, unknown>>;
    expect(resultBlocks).toHaveLength(2);
    expect(resultBlocks[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool_tc-1',
      content: JSON.stringify({ data: 'result_a' }),
    });
    expect(resultBlocks[1]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool_tc-2',
      content: JSON.stringify({ data: 'result_b' }),
    });
  });

  it('handles orphan tool_call without a result (emits assistant block, no user block)', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'orphan-1', role: 'tool_call', tool_name: 'orphan_action', tool_args: {} }),
    ];
    const result = buildClaudeMessages(history);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toEqual([
      {
        type: 'tool_use',
        id: 'tool_orphan-1',
        name: 'orphan_action',
        input: {},
      },
    ]);
  });

  it('skips orphan tool_result rows that appear without a preceding tool_call', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Hi' }),
      makeMsg({ id: 'orphan-tr', role: 'tool_result', tool_result: { stray: true } }),
      makeMsg({ id: 'a1', role: 'assistant', content: 'Reply' }),
    ];
    const result = buildClaudeMessages(history);

    // The orphan tool_result is silently skipped
    expect(result).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Reply' },
    ]);
  });

  it('handles a full conversation with mixed message types in sequence', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Create a post' }),
      makeMsg({
        id: 'tc1',
        role: 'tool_call',
        tool_name: 'create_post',
        tool_args: { text: 'Draft' },
      }),
      makeMsg({ id: 'tr1', role: 'tool_result', tool_result: { postId: '123' } }),
      makeMsg({ id: 'a1', role: 'assistant', content: 'Post created.' }),
      makeMsg({ id: 'u2', role: 'user', content: 'Thanks' }),
    ];
    const result = buildClaudeMessages(history);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ role: 'user', content: 'Create a post' });
    expect(result[1].role).toBe('assistant');
    expect((result[1].content as Array<Record<string, unknown>>)[0].type).toBe('tool_use');
    expect(result[2].role).toBe('user');
    expect((result[2].content as Array<Record<string, unknown>>)[0].type).toBe('tool_result');
    expect(result[3]).toEqual({ role: 'assistant', content: 'Post created.' });
    expect(result[4]).toEqual({ role: 'user', content: 'Thanks' });
  });

  it('uses null tool_args as empty object input', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'tc-null', role: 'tool_call', tool_name: 'get_data', tool_args: null }),
      makeMsg({ id: 'tr-null', role: 'tool_result', tool_result: { items: [] } }),
    ];
    const result = buildClaudeMessages(history);
    const useBlock = (result[0].content as Array<Record<string, unknown>>)[0];
    expect(useBlock.input).toEqual({});
  });

  it('uses empty string for tool_name when null', () => {
    const history: DbMessage[] = [
      makeMsg({ id: 'tc-noname', role: 'tool_call', tool_name: null, tool_args: {} }),
      makeMsg({ id: 'tr-noname', role: 'tool_result', tool_result: {} }),
    ];
    const result = buildClaudeMessages(history);
    const useBlock = (result[0].content as Array<Record<string, unknown>>)[0];
    expect(useBlock.name).toBe('');
  });
});
