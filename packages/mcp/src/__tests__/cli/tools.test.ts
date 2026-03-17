import { describe, it, expect } from 'vitest';
import { formatToolList, formatCategoryTools } from '../../cli/tools-command.js';

describe('tools command', () => {
  it('formatToolList returns all category names', () => {
    const output = formatToolList();
    expect(output).toContain('knowledge');
    expect(output).toContain('leadMagnets');
    expect(output).toContain('funnels');
    expect(output).toContain('emailSequences');
  });

  it('formatToolList includes tool counts', () => {
    const output = formatToolList();
    // Should contain numbers like "17 tools" or "(17)"
    expect(output).toMatch(/\d+ tools/);
  });

  it('formatCategoryTools returns tool names for valid category', () => {
    const output = formatCategoryTools('knowledge');
    expect(output).toContain('magnetlab_search_knowledge');
    expect(output).toContain('magnetlab_ask_knowledge');
  });

  it('formatCategoryTools returns error for invalid category', () => {
    const output = formatCategoryTools('nonexistent');
    expect(output).toContain('Unknown category');
  });
});
