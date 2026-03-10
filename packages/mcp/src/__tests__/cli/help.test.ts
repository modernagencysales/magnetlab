import { describe, it, expect } from 'vitest';
import { formatToolHelp } from '../../cli/help-command.js';

describe('help command', () => {
  it('returns schema for a valid tool', () => {
    const output = formatToolHelp('magnetlab_search_knowledge');
    expect(output).toContain('magnetlab_search_knowledge');
    expect(output).toContain('query');
    expect(output).toContain('limit');
  });

  it('strips magnetlab_ prefix if omitted', () => {
    const output = formatToolHelp('search_knowledge');
    expect(output).toContain('magnetlab_search_knowledge');
  });

  it('shows REQUIRED for required fields', () => {
    const output = formatToolHelp('magnetlab_create_lead_magnet');
    expect(output).toContain('REQUIRED');
    expect(output).toContain('title');
    expect(output).toContain('archetype');
  });

  it('shows enum values', () => {
    const output = formatToolHelp('magnetlab_create_lead_magnet');
    expect(output).toContain('single-breakdown');
    expect(output).toContain('focused-toolkit');
  });

  it('shows CLI flag format', () => {
    const output = formatToolHelp('magnetlab_search_knowledge');
    expect(output).toContain('--query');
    expect(output).toContain('--limit');
  });

  it('returns error for unknown tool', () => {
    const output = formatToolHelp('nonexistent_tool');
    expect(output).toContain('Unknown tool');
  });
});
