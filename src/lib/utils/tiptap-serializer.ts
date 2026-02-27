/**
 * Bidirectional converter between TipTap JSON document format and
 * PolishedBlock.content markdown string format.
 *
 * Supports: **bold**, *italic*, [text](url) inline formatting.
 */

// ─── TipTap JSON Types ─────────────────────────────────────────────

export interface TiptapMark {
  type: 'bold' | 'italic' | 'link';
  attrs?: { href: string; target: string };
}

export interface TiptapTextNode {
  type: 'text';
  text: string;
  marks?: TiptapMark[];
}

export interface TiptapParagraphNode {
  type: 'paragraph';
  content?: TiptapTextNode[];
}

export interface TiptapDoc {
  type: 'doc';
  content: TiptapParagraphNode[];
}

// ─── Markdown → TipTap ─────────────────────────────────────────────

/**
 * Combined regex that matches bold (**...**), italic (*...*), and links ([text](url)).
 * Bold is matched FIRST to avoid the italic pattern consuming the outer asterisks.
 */
const INLINE_REGEX = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;

/**
 * Parse a single line of markdown into an array of TipTap text nodes.
 */
function parseInlineMarks(line: string): TiptapTextNode[] {
  const nodes: TiptapTextNode[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(INLINE_REGEX)) {
    const matchStart = match.index!;

    // Plain text before this match
    if (matchStart > lastIndex) {
      nodes.push({ type: 'text', text: line.slice(lastIndex, matchStart) });
    }

    const [full] = match;

    if (match[1]) {
      // Bold: **text**
      nodes.push({
        type: 'text',
        text: full.slice(2, -2),
        marks: [{ type: 'bold' }],
      });
    } else if (match[2]) {
      // Italic: *text*
      nodes.push({
        type: 'text',
        text: full.slice(1, -1),
        marks: [{ type: 'italic' }],
      });
    } else if (match[3]) {
      // Link: [text](url)
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push({
          type: 'text',
          text: linkMatch[1],
          marks: [{ type: 'link', attrs: { href: linkMatch[2], target: '_blank' } }],
        });
      }
    }

    lastIndex = matchStart + full.length;
  }

  // Trailing plain text
  if (lastIndex < line.length) {
    nodes.push({ type: 'text', text: line.slice(lastIndex) });
  }

  return nodes;
}

/**
 * Convert a markdown string (using **bold**, *italic*, [text](url)) into a
 * TipTap JSON document.
 *
 * - Each line becomes a paragraph node.
 * - Empty input produces a doc with one empty paragraph.
 */
export function markdownToTiptapDoc(markdown: string): TiptapDoc {
  if (!markdown) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const lines = markdown.split('\n');

  const paragraphs: TiptapParagraphNode[] = lines.map((line) => {
    if (!line) {
      return { type: 'paragraph' };
    }

    const content = parseInlineMarks(line);
    if (content.length === 0) {
      return { type: 'paragraph' };
    }

    return { type: 'paragraph', content };
  });

  return { type: 'doc', content: paragraphs };
}

// ─── TipTap → Markdown ─────────────────────────────────────────────

/**
 * Serialize a single TipTap text node back to markdown.
 */
function serializeTextNode(node: TiptapTextNode): string {
  const { text, marks } = node;

  if (!marks || marks.length === 0) {
    return text;
  }

  let result = text;

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'link':
        result = `[${result}](${mark.attrs?.href ?? ''})`;
        break;
    }
  }

  return result;
}

/**
 * Convert a TipTap JSON document back to a markdown string.
 *
 * - Paragraphs are joined with `\n`.
 * - Empty/missing doc returns `''`.
 */
export function tiptapDocToMarkdown(doc: TiptapDoc): string {
  if (!doc || !doc.content || doc.content.length === 0) {
    return '';
  }

  const lines = doc.content.map((paragraph) => {
    if (!paragraph.content || paragraph.content.length === 0) {
      return '';
    }

    return paragraph.content.map(serializeTextNode).join('');
  });

  return lines.join('\n');
}
