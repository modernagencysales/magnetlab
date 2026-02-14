import type {
  PolishedBlock,
} from '@/lib/types/lead-magnet';

describe('PolishedBlock types', () => {
  it('accepts all original block types', () => {
    const blocks: PolishedBlock[] = [
      { type: 'paragraph', content: 'Hello' },
      { type: 'callout', content: 'Tip', style: 'info' },
      { type: 'list', content: '- item 1\n- item 2' },
      { type: 'quote', content: 'Famous words' },
      { type: 'divider', content: '' },
    ];
    expect(blocks).toHaveLength(5);
  });

  it('accepts image blocks', () => {
    const block: PolishedBlock = {
      type: 'image',
      content: '',
      src: 'https://example.com/img.png',
      alt: 'Photo',
      caption: 'A nice photo',
    };
    expect(block.type).toBe('image');
  });

  it('accepts embed blocks', () => {
    const block: PolishedBlock = {
      type: 'embed',
      content: '',
      url: 'https://youtube.com/watch?v=abc',
      provider: 'youtube',
    };
    expect(block.type).toBe('embed');
  });

  it('accepts code blocks', () => {
    const block: PolishedBlock = {
      type: 'code',
      content: 'const x = 1;',
      language: 'typescript',
    };
    expect(block.type).toBe('code');
  });

  it('accepts table blocks', () => {
    const block: PolishedBlock = {
      type: 'table',
      content: '',
      headers: ['Name', 'Value'],
      rows: [['A', '1'], ['B', '2']],
    };
    expect(block.type).toBe('table');
    expect(block.headers).toHaveLength(2);
    expect(block.rows).toHaveLength(2);
  });

  it('accepts accordion blocks', () => {
    const block: PolishedBlock = {
      type: 'accordion',
      content: 'Hidden details here',
      title: 'Click to expand',
    };
    expect(block.type).toBe('accordion');
  });
});
