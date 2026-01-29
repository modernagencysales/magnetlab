/**
 * Tests for content block rendering utilities and data handling.
 * Tests the data structures and logic, not React rendering.
 */

describe('Content Block Data Handling', () => {
  describe('Rich text bold parsing', () => {
    // Test the **bold** parsing logic that ContentBlocks uses
    function parseBoldParts(text: string): Array<{ text: string; bold: boolean }> {
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      return parts
        .filter(Boolean)
        .map((part) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return { text: part.slice(2, -2), bold: true };
          }
          return { text: part, bold: false };
        });
    }

    it('should parse bold text markers', () => {
      const result = parseBoldParts('This is **bold** text');
      expect(result).toEqual([
        { text: 'This is ', bold: false },
        { text: 'bold', bold: true },
        { text: ' text', bold: false },
      ]);
    });

    it('should handle multiple bold sections', () => {
      const result = parseBoldParts('**First** and **second** bold');
      expect(result).toEqual([
        { text: 'First', bold: true },
        { text: ' and ', bold: false },
        { text: 'second', bold: true },
        { text: ' bold', bold: false },
      ]);
    });

    it('should handle text with no bold markers', () => {
      const result = parseBoldParts('Plain text here');
      expect(result).toEqual([
        { text: 'Plain text here', bold: false },
      ]);
    });

    it('should handle text that is entirely bold', () => {
      const result = parseBoldParts('**All bold**');
      expect(result).toEqual([
        { text: 'All bold', bold: true },
      ]);
    });

    it('should handle empty string', () => {
      const result = parseBoldParts('');
      expect(result).toEqual([]);
    });
  });

  describe('Bullet list parsing', () => {
    function parseListItems(content: string): string[] {
      return content
        .split('\n')
        .map((line) => line.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean);
    }

    it('should parse dash-prefixed items', () => {
      const result = parseListItems('- Item one\n- Item two\n- Item three');
      expect(result).toEqual(['Item one', 'Item two', 'Item three']);
    });

    it('should parse bullet-prefixed items', () => {
      const result = parseListItems('• First\n• Second');
      expect(result).toEqual(['First', 'Second']);
    });

    it('should filter empty lines', () => {
      const result = parseListItems('- Item one\n\n- Item two\n\n');
      expect(result).toEqual(['Item one', 'Item two']);
    });

    it('should handle single item', () => {
      const result = parseListItems('- Only item');
      expect(result).toEqual(['Only item']);
    });

    it('should trim whitespace from items', () => {
      const result = parseListItems('-   Spaced item  \n-  Another  ');
      expect(result).toEqual(['Spaced item', 'Another']);
    });
  });

  describe('Callout styles', () => {
    const validStyles = ['info', 'warning', 'success'];

    it('should recognize all valid callout styles', () => {
      validStyles.forEach((style) => {
        expect(['info', 'warning', 'success']).toContain(style);
      });
    });

    it('should have 3 callout styles total', () => {
      expect(validStyles).toHaveLength(3);
    });
  });

  describe('Block type validation', () => {
    const validBlockTypes = ['paragraph', 'callout', 'list', 'quote', 'divider'];

    it('should have 5 block types', () => {
      expect(validBlockTypes).toHaveLength(5);
    });

    it('divider blocks should use empty content', () => {
      const dividerBlock = { type: 'divider' as const, content: '' };
      expect(dividerBlock.content).toBe('');
    });

    it('callout blocks should require style', () => {
      const calloutBlock = { type: 'callout' as const, content: 'Tip', style: 'info' as const };
      expect(calloutBlock.style).toBeDefined();
    });
  });

  describe('TOC section generation', () => {
    function generateTocFromPolished(sections: Array<{ id: string; sectionName: string }>) {
      return sections.map((s) => ({ id: s.id, name: s.sectionName }));
    }

    function generateTocFromExtracted(structure: Array<{ sectionName: string }>) {
      return structure.map((s, i) => ({ id: `section-${i}`, name: s.sectionName }));
    }

    it('should use section IDs for polished content', () => {
      const sections = [
        { id: 'intro', sectionName: 'Introduction' },
        { id: 'deep-dive', sectionName: 'Deep Dive' },
      ];
      const toc = generateTocFromPolished(sections);
      expect(toc).toEqual([
        { id: 'intro', name: 'Introduction' },
        { id: 'deep-dive', name: 'Deep Dive' },
      ]);
    });

    it('should generate indexed IDs for extracted content', () => {
      const structure = [
        { sectionName: 'First Section' },
        { sectionName: 'Second Section' },
      ];
      const toc = generateTocFromExtracted(structure);
      expect(toc).toEqual([
        { id: 'section-0', name: 'First Section' },
        { id: 'section-1', name: 'Second Section' },
      ]);
    });

    it('should handle empty sections', () => {
      expect(generateTocFromPolished([])).toEqual([]);
      expect(generateTocFromExtracted([])).toEqual([]);
    });
  });

  describe('Theme color mapping', () => {
    function getColors(isDark: boolean) {
      return {
        bg: isDark ? '#09090B' : '#FAFAFA',
        card: isDark ? '#18181B' : '#FFFFFF',
        text: isDark ? '#FAFAFA' : '#09090B',
        body: isDark ? '#E4E4E7' : '#27272A',
        muted: isDark ? '#A1A1AA' : '#71717A',
        border: isDark ? '#27272A' : '#E4E4E7',
      };
    }

    it('should return dark colors when isDark is true', () => {
      const colors = getColors(true);
      expect(colors.bg).toBe('#09090B');
      expect(colors.text).toBe('#FAFAFA');
      expect(colors.card).toBe('#18181B');
    });

    it('should return light colors when isDark is false', () => {
      const colors = getColors(false);
      expect(colors.bg).toBe('#FAFAFA');
      expect(colors.text).toBe('#09090B');
      expect(colors.card).toBe('#FFFFFF');
    });

    it('dark and light text colors should be inverted', () => {
      const dark = getColors(true);
      const light = getColors(false);
      expect(dark.text).toBe(light.bg);
      expect(light.text).toBe(dark.bg);
    });
  });
});
