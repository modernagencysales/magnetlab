/** Chat History Builder.
 *  Converts Supabase copilot_messages rows into Claude API message format.
 *  Handles deterministic tool_use IDs and consecutive tool_call/tool_result pairing.
 *  Never imports NextRequest, NextResponse, or cookies. */

// ─── Types ───────────────────────────────────────────────

export interface DbMessage {
  id: string;
  role: string;
  content: string | null;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

// ─── Builder ─────────────────────────────────────────────

export function buildClaudeMessages(history: DbMessage[]): ClaudeMessage[] {
  const claudeMessages: ClaudeMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];

    if (msg.role === 'user') {
      claudeMessages.push({ role: 'user', content: msg.content || '' });
    } else if (msg.role === 'assistant') {
      claudeMessages.push({ role: 'assistant', content: msg.content || '' });
    } else if (msg.role === 'tool_call') {
      // Collect all consecutive tool_call + tool_result pairs into one assistant + one user message
      const toolUseBlocks: Array<Record<string, unknown>> = [];
      const toolResultBlocks: Array<Record<string, unknown>> = [];

      while (i < history.length && history[i].role === 'tool_call') {
        const tc = history[i];
        const toolId = `tool_${tc.id}`;
        toolUseBlocks.push({
          type: 'tool_use',
          id: toolId,
          name: tc.tool_name || '',
          input: tc.tool_args || {},
        });

        // Look for matching tool_result immediately after
        if (i + 1 < history.length && history[i + 1].role === 'tool_result') {
          const tr = history[i + 1];
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolId,
            content: JSON.stringify(tr.tool_result),
          });
          i += 2;
        } else {
          i++;
        }
      }
      i--; // Adjust for outer loop increment

      if (toolUseBlocks.length > 0) {
        claudeMessages.push({ role: 'assistant', content: toolUseBlocks });
      }
      if (toolResultBlocks.length > 0) {
        claudeMessages.push({ role: 'user', content: toolResultBlocks });
      }
    }
    // Skip orphan tool_result (handled above)
  }

  return claudeMessages;
}
