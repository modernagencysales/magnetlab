/**
 * @jest-environment node
 */

import {
  markdownToTiptapDoc,
  tiptapDocToMarkdown,
  TiptapDoc,
} from '@/lib/utils/tiptap-serializer';

// ─── markdownToTiptapDoc ────────────────────────────────────────────

describe('markdownToTiptapDoc', () => {
  it('should convert plain text to a doc with one paragraph', () => {
    const doc = markdownToTiptapDoc('Hello world');
    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    });
  });

  it('should return a doc with one empty paragraph for empty string', () => {
    const doc = markdownToTiptapDoc('');
    expect(doc).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
  });

  it('should parse **bold** text', () => {
    const doc = markdownToTiptapDoc('This is **bold** text');
    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' text' },
          ],
        },
      ],
    });
  });

  it('should parse *italic* text', () => {
    const doc = markdownToTiptapDoc('This is *italic* text');
    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' text' },
          ],
        },
      ],
    });
  });

  it('should parse [text](url) links', () => {
    const doc = markdownToTiptapDoc('Click [here](https://example.com) now');
    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Click ' },
            {
              type: 'text',
              text: 'here',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.com', target: '_blank' },
                },
              ],
            },
            { type: 'text', text: ' now' },
          ],
        },
      ],
    });
  });

  it('should handle multiple marks in one line', () => {
    const doc = markdownToTiptapDoc('**bold** and *italic* and [link](https://x.com)');
    expect(doc.content[0].content).toEqual([
      { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' and ' },
      {
        type: 'text',
        text: 'link',
        marks: [
          {
            type: 'link',
            attrs: { href: 'https://x.com', target: '_blank' },
          },
        ],
      },
    ]);
  });

  it('should handle multi-line markdown (multiple paragraphs)', () => {
    const doc = markdownToTiptapDoc('Line one\nLine two\nLine three');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0].content).toEqual([{ type: 'text', text: 'Line one' }]);
    expect(doc.content[1].content).toEqual([{ type: 'text', text: 'Line two' }]);
    expect(doc.content[2].content).toEqual([{ type: 'text', text: 'Line three' }]);
  });

  it('should handle empty lines as empty paragraphs', () => {
    const doc = markdownToTiptapDoc('Above\n\nBelow');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0].content).toEqual([{ type: 'text', text: 'Above' }]);
    expect(doc.content[1]).toEqual({ type: 'paragraph' });
    expect(doc.content[2].content).toEqual([{ type: 'text', text: 'Below' }]);
  });

  it('should handle bold at the start of a line', () => {
    const doc = markdownToTiptapDoc('**Start** of line');
    expect(doc.content[0].content![0]).toEqual({
      type: 'text',
      text: 'Start',
      marks: [{ type: 'bold' }],
    });
  });

  it('should handle bold at the end of a line', () => {
    const doc = markdownToTiptapDoc('End of **line**');
    const content = doc.content[0].content!;
    expect(content[content.length - 1]).toEqual({
      type: 'text',
      text: 'line',
      marks: [{ type: 'bold' }],
    });
  });

  it('should not confuse **bold** with *italic*', () => {
    const doc = markdownToTiptapDoc('**bold** then *italic*');
    const content = doc.content[0].content!;
    expect(content[0]).toEqual({
      type: 'text',
      text: 'bold',
      marks: [{ type: 'bold' }],
    });
    expect(content[2]).toEqual({
      type: 'text',
      text: 'italic',
      marks: [{ type: 'italic' }],
    });
  });
});

// ─── tiptapDocToMarkdown ────────────────────────────────────────────

describe('tiptapDocToMarkdown', () => {
  it('should convert a plain text paragraph to string', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe('Hello world');
  });

  it('should return empty string for empty doc', () => {
    const doc: TiptapDoc = { type: 'doc', content: [] };
    expect(tiptapDocToMarkdown(doc)).toBe('');
  });

  it('should return empty string for null/undefined doc', () => {
    expect(tiptapDocToMarkdown(null as unknown as TiptapDoc)).toBe('');
    expect(tiptapDocToMarkdown(undefined as unknown as TiptapDoc)).toBe('');
  });

  it('should serialize bold marks to **text**', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' text' },
          ],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe('This is **bold** text');
  });

  it('should serialize italic marks to *text*', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' text' },
          ],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe('This is *italic* text');
  });

  it('should serialize link marks to [text](href)', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Click ' },
            {
              type: 'text',
              text: 'here',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.com', target: '_blank' },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe('Click [here](https://example.com)');
  });

  it('should join multiple paragraphs with newlines', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second' }],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe('First\nSecond');
  });

  it('should handle empty paragraphs as empty lines', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Above' }],
        },
        { type: 'paragraph' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Below' }],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe('Above\n\nBelow');
  });
});

// ─── Roundtrip Tests ────────────────────────────────────────────────

describe('roundtrip: markdown -> tiptap -> markdown', () => {
  const cases = [
    'Plain text only',
    'This is **bold** text',
    'This is *italic* text',
    'Click [here](https://example.com) now',
    '**bold** and *italic* and [link](https://x.com)',
    'First line\nSecond line',
    'Above\n\nBelow',
    '**Start** of line',
    'End of **line**',
    'No formatting at all',
    'Multiple **bold** words **here** in one line',
    'A *subtle* point with *two* italics',
    'Visit [Google](https://google.com) or [GitHub](https://github.com)',
  ];

  it.each(cases)('roundtrips correctly: %s', (input) => {
    const doc = markdownToTiptapDoc(input);
    const output = tiptapDocToMarkdown(doc);
    expect(output).toBe(input);
  });

  it('roundtrips empty string correctly', () => {
    const doc = markdownToTiptapDoc('');
    const output = tiptapDocToMarkdown(doc);
    expect(output).toBe('');
  });
});
