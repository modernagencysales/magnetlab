import { describe, it, expect } from 'vitest';
import { generateClaudeMdSection, generateInitFiles } from '../../cli/init.js';
import { slashCommands } from '../../cli/commands/index.js';

describe('init command', () => {
  describe('generateClaudeMdSection', () => {
    it('returns non-empty markdown', () => {
      const section = generateClaudeMdSection();
      expect(section.length).toBeGreaterThan(100);
    });

    it('mentions magnetlab exec', () => {
      const section = generateClaudeMdSection();
      expect(section).toContain('magnetlab exec');
    });

    it('mentions magnetlab guide', () => {
      const section = generateClaudeMdSection();
      expect(section).toContain('magnetlab guide');
    });

    it('lists available slash commands', () => {
      const section = generateClaudeMdSection();
      for (const cmd of Object.values(slashCommands)) {
        expect(section).toContain(cmd.filename.replace('.md', ''));
      }
    });
  });

  describe('generateInitFiles', () => {
    it('returns files for all slash commands plus CLAUDE.md section', () => {
      const files = generateInitFiles();
      // 6 slash commands
      const commandFiles = files.filter((f) => f.path.includes('.claude/commands/'));
      expect(commandFiles).toHaveLength(6);
    });

    it('all command files have .md extension', () => {
      const files = generateInitFiles();
      const commandFiles = files.filter((f) => f.path.includes('.claude/commands/'));
      for (const file of commandFiles) {
        expect(file.path).toMatch(/\.md$/);
      }
    });

    it('returns CLAUDE.md section as a separate entry', () => {
      const files = generateInitFiles();
      const claudeMd = files.find((f) => f.type === 'claude-md-section');
      expect(claudeMd).toBeDefined();
      expect(claudeMd!.content.length).toBeGreaterThan(100);
    });
  });
});
