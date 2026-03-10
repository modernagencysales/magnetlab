import { describe, it, expect } from 'vitest';
import { parseFlags, resolveToolName } from '../../cli/exec.js';

describe('resolveToolName', () => {
  it('returns full name when magnetlab_ prefix present', () => {
    expect(resolveToolName('magnetlab_search_knowledge')).toBe('magnetlab_search_knowledge');
  });

  it('adds magnetlab_ prefix when missing', () => {
    expect(resolveToolName('search_knowledge')).toBe('magnetlab_search_knowledge');
  });

  it('returns null for unknown tool', () => {
    expect(resolveToolName('totally_fake_tool')).toBeNull();
  });
});

describe('parseFlags', () => {
  it('parses string flags', () => {
    const result = parseFlags('magnetlab_search_knowledge', ['--query', 'cold email']);
    expect(result).toEqual({ query: 'cold email' });
  });

  it('converts kebab-case to snake_case', () => {
    const result = parseFlags('magnetlab_generate_lead_magnet_content', [
      '--lead-magnet-id',
      'abc',
    ]);
    expect(result).toEqual({ lead_magnet_id: 'abc' });
  });

  it('parses boolean flags (--use-brain becomes true)', () => {
    const result = parseFlags('magnetlab_create_lead_magnet', [
      '--title',
      'Test',
      '--archetype',
      'prompt',
      '--use-brain',
    ]);
    expect(result.use_brain).toBe(true);
  });

  it('parses number flags', () => {
    const result = parseFlags('magnetlab_search_knowledge', ['--limit', '5']);
    expect(result.limit).toBe(5);
  });

  it('parses JSON object flags', () => {
    const result = parseFlags('magnetlab_create_lead_magnet', [
      '--title',
      'Test',
      '--archetype',
      'prompt',
      '--funnel-config',
      '{"slug":"test","theme":"dark"}',
    ]);
    expect(result.funnel_config).toEqual({ slug: 'test', theme: 'dark' });
  });

  it('parses JSON array flags', () => {
    const result = parseFlags('magnetlab_create_lead_magnet', [
      '--title',
      'Test',
      '--archetype',
      'prompt',
      '--knowledge-entry-ids',
      '["id1","id2"]',
    ]);
    expect(result.knowledge_entry_ids).toEqual(['id1', 'id2']);
  });

  it('returns empty object for no flags', () => {
    const result = parseFlags('magnetlab_list_lead_magnets', []);
    expect(result).toEqual({});
  });
});
