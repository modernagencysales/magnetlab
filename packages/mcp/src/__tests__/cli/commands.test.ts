import { describe, it, expect } from 'vitest';
import { slashCommands } from '../../cli/commands/index.js';

describe('slash command templates', () => {
  it('exports exactly 6 slash commands', () => {
    expect(Object.keys(slashCommands)).toHaveLength(6);
  });

  it('all commands have filename, content, and description', () => {
    for (const [key, cmd] of Object.entries(slashCommands)) {
      expect(cmd.filename, `${key} missing filename`).toBeTruthy();
      expect(cmd.filename).toMatch(/\.md$/);
      expect(cmd.content, `${key} missing content`).toBeTruthy();
      expect(cmd.content.length, `${key} content too short`).toBeGreaterThan(50);
      expect(cmd.description, `${key} missing description`).toBeTruthy();
    }
  });

  it('all commands reference magnetlab exec', () => {
    for (const [key, cmd] of Object.entries(slashCommands)) {
      expect(cmd.content, `${key} should reference magnetlab exec`).toContain('magnetlab exec');
    }
  });

  it('create-lead-magnet uses $ARGUMENTS', () => {
    expect(slashCommands['create-lead-magnet'].content).toContain('$ARGUMENTS');
  });

  it('write-post uses $ARGUMENTS', () => {
    expect(slashCommands['write-post'].content).toContain('$ARGUMENTS');
  });

  it('check-brain uses $ARGUMENTS', () => {
    expect(slashCommands['check-brain'].content).toContain('$ARGUMENTS');
  });

  it('lead-magnet-status uses $ARGUMENTS', () => {
    expect(slashCommands['lead-magnet-status'].content).toContain('$ARGUMENTS');
  });

  it('create-lead-magnet references key workflow steps', () => {
    const content = slashCommands['create-lead-magnet'].content;
    expect(content).toContain('knowledge_readiness');
    expect(content).toContain('search_knowledge');
    expect(content).toContain('synthesize_position');
    expect(content).toContain('create_lead_magnet');
    expect(content).toContain('generate_lead_magnet_content');
    expect(content).toContain('generate_email_sequence');
    expect(content).toContain('activate_email_sequence');
    expect(content).toContain('publish_funnel');
  });

  it('all commands end with a summary instruction', () => {
    for (const [key, cmd] of Object.entries(slashCommands)) {
      expect(cmd.content.toLowerCase(), `${key} should mention summary`).toMatch(
        /summary|present|report/
      );
    }
  });
});
