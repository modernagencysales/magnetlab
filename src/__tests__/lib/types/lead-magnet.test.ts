import type {
  PolishedContent,
  PolishedSection,
  PolishedBlock,
  PolishedBlockType,
  CalloutStyle,
} from '@/lib/types/lead-magnet';

describe('PolishedContent Types', () => {
  const mockPolishedContent: PolishedContent = {
    version: 1,
    polishedAt: '2025-01-28T00:00:00Z',
    sections: [
      {
        id: 'section-intro',
        sectionName: 'Introduction',
        introduction: 'This section covers the basics.',
        blocks: [
          { type: 'paragraph', content: 'This is a **bold** paragraph.' },
          { type: 'callout', content: 'Key insight here', style: 'info' },
          { type: 'list', content: '- Item one\n- Item two\n- Item three' },
          { type: 'quote', content: 'A memorable statement' },
          { type: 'divider', content: '' },
        ],
        keyTakeaway: 'The main insight from this section.',
      },
      {
        id: 'section-deep-dive',
        sectionName: 'Deep Dive',
        introduction: 'Going deeper into the topic.',
        blocks: [
          { type: 'paragraph', content: 'More detailed content here.' },
          { type: 'callout', content: 'Watch out for this', style: 'warning' },
          { type: 'callout', content: 'Great job!', style: 'success' },
        ],
        keyTakeaway: 'Key insight from deep dive.',
      },
    ],
    heroSummary: 'A compelling hook that makes you want to read more.',
    metadata: {
      readingTimeMinutes: 5,
      wordCount: 1200,
    },
  };

  describe('PolishedContent structure', () => {
    it('should have correct version', () => {
      expect(mockPolishedContent.version).toBe(1);
    });

    it('should have a valid polishedAt timestamp', () => {
      const date = new Date(mockPolishedContent.polishedAt);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should have at least one section', () => {
      expect(mockPolishedContent.sections.length).toBeGreaterThan(0);
    });

    it('should have a heroSummary', () => {
      expect(mockPolishedContent.heroSummary).toBeTruthy();
    });

    it('should have metadata with reading time and word count', () => {
      expect(mockPolishedContent.metadata.readingTimeMinutes).toBeGreaterThan(0);
      expect(mockPolishedContent.metadata.wordCount).toBeGreaterThan(0);
    });
  });

  describe('PolishedSection structure', () => {
    const section: PolishedSection = mockPolishedContent.sections[0];

    it('should have a unique id', () => {
      expect(section.id).toBe('section-intro');
    });

    it('should have a sectionName', () => {
      expect(section.sectionName).toBe('Introduction');
    });

    it('should have an introduction', () => {
      expect(section.introduction).toBeTruthy();
    });

    it('should have blocks array', () => {
      expect(Array.isArray(section.blocks)).toBe(true);
      expect(section.blocks.length).toBeGreaterThan(0);
    });

    it('should have a keyTakeaway', () => {
      expect(section.keyTakeaway).toBeTruthy();
    });
  });

  describe('PolishedBlock types', () => {
    const allBlockTypes: PolishedBlockType[] = ['paragraph', 'callout', 'list', 'quote', 'divider'];

    it('should support all block types', () => {
      const blocks = mockPolishedContent.sections[0].blocks;
      const typesFound = new Set(blocks.map((b: PolishedBlock) => b.type));
      allBlockTypes.forEach((type) => {
        expect(typesFound.has(type)).toBe(true);
      });
    });

    it('paragraph block should have content', () => {
      const paragraph = mockPolishedContent.sections[0].blocks[0];
      expect(paragraph.type).toBe('paragraph');
      expect(paragraph.content).toBeTruthy();
    });

    it('callout block should have content and style', () => {
      const callout = mockPolishedContent.sections[0].blocks[1];
      expect(callout.type).toBe('callout');
      expect(callout.content).toBeTruthy();
      expect(callout.style).toBe('info');
    });

    it('list block should have newline-separated items', () => {
      const list = mockPolishedContent.sections[0].blocks[2];
      expect(list.type).toBe('list');
      expect(list.content).toContain('\n');
    });

    it('quote block should have content', () => {
      const quote = mockPolishedContent.sections[0].blocks[3];
      expect(quote.type).toBe('quote');
      expect(quote.content).toBeTruthy();
    });

    it('divider block should have empty content', () => {
      const divider = mockPolishedContent.sections[0].blocks[4];
      expect(divider.type).toBe('divider');
      expect(divider.content).toBe('');
    });
  });

  describe('CalloutStyle variants', () => {
    const allStyles: CalloutStyle[] = ['info', 'warning', 'success'];

    it('should support all callout styles', () => {
      const allBlocks = mockPolishedContent.sections.flatMap((s) => s.blocks);
      const callouts = allBlocks.filter((b: PolishedBlock) => b.type === 'callout');
      const stylesFound = new Set(callouts.map((c: PolishedBlock) => c.style));
      allStyles.forEach((style) => {
        expect(stylesFound.has(style)).toBe(true);
      });
    });
  });

  describe('Section IDs for anchor linking', () => {
    it('sections should have unique ids', () => {
      const ids = mockPolishedContent.sections.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
