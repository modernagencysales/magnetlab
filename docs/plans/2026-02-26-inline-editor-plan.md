# Inline Notion-Style Content Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the batch section editor with an inline Notion-style editor that lets users edit content directly on the rendered lead magnet page.

**Architecture:** Hybrid approach — TipTap (ProseMirror) for text blocks (paragraph, callout, list, quote) with inline bold/italic/link formatting, custom styled editors with hover popovers for structured blocks (table, code, image, etc.). Data model and save API unchanged.

**Tech Stack:** TipTap v2 (@tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/suggestion), React 18.3, Next.js 15

**Design doc:** `docs/plans/2026-02-26-inline-editor-design.md`

---

### Task 1: Install TipTap Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/suggestion @tiptap/pm tippy.js
```

**Step 2: Verify installation**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
node -e "require('@tiptap/react'); require('@tiptap/starter-kit'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add TipTap editor dependencies"
```

---

### Task 2: TipTap ↔ PolishedContent Serializer

The core conversion layer between TipTap's JSON document format and the existing `PolishedBlock.content` markdown string format (`**bold**`, `*italic*`, `[text](url)`).

**Files:**
- Create: `src/lib/utils/tiptap-serializer.ts`
- Create: `src/__tests__/lib/tiptap-serializer.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/lib/tiptap-serializer.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { markdownToTiptapDoc, tiptapDocToMarkdown } from '@/lib/utils/tiptap-serializer';

describe('tiptap-serializer', () => {
  describe('markdownToTiptapDoc', () => {
    it('converts plain text', () => {
      const doc = markdownToTiptapDoc('Hello world');
      expect(doc.type).toBe('doc');
      expect(doc.content).toHaveLength(1);
      expect(doc.content![0].type).toBe('paragraph');
      expect(doc.content![0].content![0].text).toBe('Hello world');
    });

    it('converts **bold** markers', () => {
      const doc = markdownToTiptapDoc('This is **bold** text');
      const paraContent = doc.content![0].content!;
      expect(paraContent).toHaveLength(3);
      expect(paraContent[0].text).toBe('This is ');
      expect(paraContent[1].text).toBe('bold');
      expect(paraContent[1].marks).toEqual([{ type: 'bold' }]);
      expect(paraContent[2].text).toBe(' text');
    });

    it('converts *italic* markers', () => {
      const doc = markdownToTiptapDoc('This is *italic* text');
      const paraContent = doc.content![0].content!;
      expect(paraContent[1].text).toBe('italic');
      expect(paraContent[1].marks).toEqual([{ type: 'italic' }]);
    });

    it('converts [text](url) links', () => {
      const doc = markdownToTiptapDoc('Click [here](https://example.com) now');
      const paraContent = doc.content![0].content!;
      expect(paraContent[1].text).toBe('here');
      expect(paraContent[1].marks).toEqual([{ type: 'link', attrs: { href: 'https://example.com', target: '_blank' } }]);
    });

    it('converts multi-line text to multiple paragraphs', () => {
      const doc = markdownToTiptapDoc('Line one\nLine two\nLine three');
      expect(doc.content).toHaveLength(3);
    });

    it('handles empty string', () => {
      const doc = markdownToTiptapDoc('');
      expect(doc.type).toBe('doc');
      expect(doc.content).toHaveLength(1);
      expect(doc.content![0].type).toBe('paragraph');
    });

    it('handles combined marks', () => {
      const doc = markdownToTiptapDoc('This is **bold and *italic*** text');
      // Should parse bold correctly; nested italic inside bold is an edge case
      // At minimum, the bold should be extracted
      const paraContent = doc.content![0].content!;
      const boldNode = paraContent.find(n => n.marks?.some(m => m.type === 'bold'));
      expect(boldNode).toBeDefined();
    });
  });

  describe('tiptapDocToMarkdown', () => {
    it('converts plain text', () => {
      const doc = {
        type: 'doc' as const,
        content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Hello world' }] }],
      };
      expect(tiptapDocToMarkdown(doc)).toBe('Hello world');
    });

    it('converts bold marks to **bold**', () => {
      const doc = {
        type: 'doc' as const,
        content: [{
          type: 'paragraph' as const,
          content: [
            { type: 'text' as const, text: 'This is ' },
            { type: 'text' as const, text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text' as const, text: ' text' },
          ],
        }],
      };
      expect(tiptapDocToMarkdown(doc)).toBe('This is **bold** text');
    });

    it('converts italic marks to *italic*', () => {
      const doc = {
        type: 'doc' as const,
        content: [{
          type: 'paragraph' as const,
          content: [
            { type: 'text' as const, text: 'This is ' },
            { type: 'text' as const, text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text' as const, text: ' text' },
          ],
        }],
      };
      expect(tiptapDocToMarkdown(doc)).toBe('This is *italic* text');
    });

    it('converts link marks to [text](url)', () => {
      const doc = {
        type: 'doc' as const,
        content: [{
          type: 'paragraph' as const,
          content: [
            { type: 'text' as const, text: 'Click ' },
            { type: 'text' as const, text: 'here', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
          ],
        }],
      };
      expect(tiptapDocToMarkdown(doc)).toBe('Click [here](https://example.com)');
    });

    it('joins multiple paragraphs with newlines', () => {
      const doc = {
        type: 'doc' as const,
        content: [
          { type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Line one' }] },
          { type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Line two' }] },
        ],
      };
      expect(tiptapDocToMarkdown(doc)).toBe('Line one\nLine two');
    });

    it('handles empty doc', () => {
      const doc = { type: 'doc' as const, content: [{ type: 'paragraph' as const }] };
      expect(tiptapDocToMarkdown(doc)).toBe('');
    });
  });

  describe('roundtrip', () => {
    it('plain text survives roundtrip', () => {
      const original = 'Hello world';
      expect(tiptapDocToMarkdown(markdownToTiptapDoc(original))).toBe(original);
    });

    it('bold text survives roundtrip', () => {
      const original = 'This is **bold** text';
      expect(tiptapDocToMarkdown(markdownToTiptapDoc(original))).toBe(original);
    });

    it('italic text survives roundtrip', () => {
      const original = 'This is *italic* text';
      expect(tiptapDocToMarkdown(markdownToTiptapDoc(original))).toBe(original);
    });

    it('links survive roundtrip', () => {
      const original = 'Click [here](https://example.com) now';
      expect(tiptapDocToMarkdown(markdownToTiptapDoc(original))).toBe(original);
    });

    it('multiline text survives roundtrip', () => {
      const original = 'Line one\nLine two\nLine three';
      expect(tiptapDocToMarkdown(markdownToTiptapDoc(original))).toBe(original);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/tiptap-serializer.test.ts --no-coverage 2>&1 | tail -5`
Expected: FAIL — module not found

**Step 3: Implement the serializer**

Create `src/lib/utils/tiptap-serializer.ts`:

```typescript
/**
 * Bidirectional converter between PolishedBlock markdown content strings
 * and TipTap JSON document format.
 *
 * Supported marks: **bold**, *italic*, [text](url)
 */

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
}

// ─── Markdown → TipTap ───────────────────────────────────────────────

/**
 * Parse a markdown-ish content string into a TipTap-compatible JSON doc.
 * Supports: **bold**, *italic*, [text](url), newlines → paragraphs.
 */
export function markdownToTiptapDoc(markdown: string): TipTapNode {
  if (!markdown) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const lines = markdown.split('\n');
  const paragraphs: TipTapNode[] = lines.map((line) => {
    if (!line) return { type: 'paragraph' };
    const nodes = parseInlineMarks(line);
    return { type: 'paragraph', content: nodes };
  });

  return { type: 'doc', content: paragraphs };
}

/**
 * Parse inline markdown marks from a single line of text.
 * Processes: **bold**, *italic*, [text](url)
 */
function parseInlineMarks(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  // Regex matches **bold**, *italic*, or [text](url)
  const pattern = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    const full = match[0];

    if (match[1]) {
      // **bold**
      nodes.push({
        type: 'text',
        text: full.slice(2, -2),
        marks: [{ type: 'bold' }],
      });
    } else if (match[2]) {
      // *italic*
      nodes.push({
        type: 'text',
        text: full.slice(1, -1),
        marks: [{ type: 'italic' }],
      });
    } else if (match[3]) {
      // [text](url)
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push({
          type: 'text',
          text: linkMatch[1],
          marks: [{ type: 'link', attrs: { href: linkMatch[2], target: '_blank' } }],
        });
      }
    }

    lastIndex = match.index + full.length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return nodes;
}

// ─── TipTap → Markdown ───────────────────────────────────────────────

/**
 * Serialize a TipTap JSON doc back to a markdown-ish content string.
 */
export function tiptapDocToMarkdown(doc: TipTapNode): string {
  if (!doc.content?.length) return '';

  return doc.content
    .map((node) => {
      if (node.type === 'paragraph') {
        return serializeParagraph(node);
      }
      // bulletList, listItem, etc. — fallback
      if (node.type === 'bulletList' && node.content) {
        return node.content
          .map((li) => {
            const text = li.content?.map(serializeParagraph).join('\n') || '';
            return `- ${text}`;
          })
          .join('\n');
      }
      return serializeParagraph(node);
    })
    .join('\n');
}

function serializeParagraph(node: TipTapNode): string {
  if (!node.content?.length) return '';

  return node.content
    .map((child) => {
      if (child.type !== 'text' || !child.text) return '';

      let text = child.text;
      if (child.marks?.length) {
        for (const mark of child.marks) {
          if (mark.type === 'bold') {
            text = `**${text}**`;
          } else if (mark.type === 'italic') {
            text = `*${text}*`;
          } else if (mark.type === 'link' && mark.attrs?.href) {
            text = `[${text}](${mark.attrs.href})`;
          }
        }
      }
      return text;
    })
    .join('');
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/tiptap-serializer.test.ts --no-coverage 2>&1 | tail -5`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/lib/utils/tiptap-serializer.ts src/__tests__/lib/tiptap-serializer.test.ts
git commit -m "feat: add TipTap ↔ PolishedContent markdown serializer with tests"
```

---

### Task 3: TipTapTextBlock Component

A reusable TipTap editor wrapper for text blocks (paragraph, callout, list, quote) that renders inline with the page styling.

**Files:**
- Create: `src/components/content/inline-editor/TipTapTextBlock.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Italic, Link as LinkIcon, Unlink } from 'lucide-react';
import { markdownToTiptapDoc, tiptapDocToMarkdown } from '@/lib/utils/tiptap-serializer';

interface TipTapTextBlockProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
}

export function TipTapTextBlock({
  content,
  onChange,
  placeholder = 'Start typing...',
  className,
  style,
  multiline = true,
}: TipTapTextBlockProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level nodes we don't need per-block
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        hardBreak: multiline ? undefined : false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: markdownToTiptapDoc(content),
    onUpdate: ({ editor }) => {
      const md = tiptapDocToMarkdown(editor.getJSON());
      onChangeRef.current(md);
    },
    editorProps: {
      attributes: {
        class: className || '',
        style: style ? Object.entries(style).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';') : '',
      },
      handleKeyDown: multiline ? undefined : (_view, event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });

  // Sync external content changes (e.g. AI regeneration)
  const lastContentRef = useRef(content);
  useEffect(() => {
    if (editor && content !== lastContentRef.current) {
      const currentMd = tiptapDocToMarkdown(editor.getJSON());
      if (content !== currentMd) {
        editor.commands.setContent(markdownToTiptapDoc(content));
      }
      lastContentRef.current = content;
    }
  }, [content, editor]);

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-text-block relative">
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 150, placement: 'top' }}
        >
          <div
            className="flex items-center gap-0.5 rounded-lg border bg-popover px-1 py-0.5 shadow-lg"
          >
            <button
              onClick={toggleBold}
              className={`rounded p-1.5 text-xs hover:bg-muted ${editor.isActive('bold') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
              title="Bold"
            >
              <Bold size={14} />
            </button>
            <button
              onClick={toggleItalic}
              className={`rounded p-1.5 text-xs hover:bg-muted ${editor.isActive('italic') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
              title="Italic"
            >
              <Italic size={14} />
            </button>
            {editor.isActive('link') ? (
              <button
                onClick={removeLink}
                className="rounded p-1.5 text-xs text-red-500 hover:bg-muted"
                title="Remove link"
              >
                <Unlink size={14} />
              </button>
            ) : showLinkInput ? (
              <form onSubmit={(e) => { e.preventDefault(); setLink(); }} className="flex items-center gap-1">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-6 w-40 rounded border bg-background px-1.5 text-xs"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowLinkInput(false); }}
                />
              </form>
            ) : (
              <button
                onClick={() => setShowLinkInput(true)}
                className="rounded p-1.5 text-xs text-muted-foreground hover:bg-muted"
                title="Add link"
              >
                <LinkIcon size={14} />
              </button>
            )}
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | grep "inline-editor" | head -5`
Expected: No errors for this file (pre-existing errors in other files are OK)

**Step 3: Commit**

```bash
git add src/components/content/inline-editor/TipTapTextBlock.tsx
git commit -m "feat: add TipTapTextBlock component with bubble menu toolbar"
```

---

### Task 4: BlockHoverControls Component

Shows a gutter with drag handle and context menu on block hover.

**Files:**
- Create: `src/components/content/inline-editor/BlockHoverControls.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Trash2, MoreHorizontal } from 'lucide-react';

interface BlockHoverControlsProps {
  blockType: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  children: React.ReactNode;
}

export function BlockHoverControls({
  blockType,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
  children,
}: BlockHoverControlsProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
    >
      {/* Gutter controls — visible on hover */}
      <div
        className="absolute -left-10 top-0 flex flex-col items-center gap-0.5 transition-opacity duration-150"
        style={{ opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none' }}
      >
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={blockType}
        >
          <GripVertical size={16} />
        </button>
      </div>

      {/* Context menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute -left-10 top-6 z-50 min-w-[140px] rounded-lg border bg-popover p-1 shadow-lg"
        >
          <button
            onClick={() => { onMoveUp(); setShowMenu(false); }}
            disabled={!canMoveUp}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
          >
            <ChevronUp size={14} /> Move up
          </button>
          <button
            onClick={() => { onMoveDown(); setShowMenu(false); }}
            disabled={!canMoveDown}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
          >
            <ChevronDown size={14} /> Move down
          </button>
          <hr className="my-1 border-border" />
          <button
            onClick={() => { onDelete(); setShowMenu(false); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* Subtle hover outline */}
      <div
        className="rounded-md transition-all duration-150"
        style={{
          outline: isHovered ? '1px solid var(--border)' : '1px solid transparent',
          outlineOffset: '4px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content/inline-editor/BlockHoverControls.tsx
git commit -m "feat: add BlockHoverControls with gutter drag handle and context menu"
```

---

### Task 5: StructuredBlockOverlay Component

Wraps structured blocks (table, code, image, etc.) — renders the published view with a gear icon that opens a popover for editing.

**Files:**
- Create: `src/components/content/inline-editor/StructuredBlockOverlay.tsx`

**Step 1: Create the component**

This reuses the existing form editors from `EditablePolishedContentRenderer` but renders them in a floating popover instead of inline. The block itself always renders in its final published form.

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import type { PolishedBlock, CalloutStyle } from '@/lib/types/lead-magnet';

interface StructuredBlockOverlayProps {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
  primaryColor: string;
  /** The read-only rendered block */
  children: React.ReactNode;
}

export function StructuredBlockOverlay({
  block,
  onChange,
  isDark,
  primaryColor,
  children,
}: StructuredBlockOverlayProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!showEditor) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowEditor(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEditor]);

  const inputClass = `w-full rounded border bg-background px-2 py-1.5 text-sm ${isDark ? 'border-zinc-700 text-zinc-200' : 'border-zinc-300 text-zinc-800'}`;
  const labelClass = 'text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground';

  const renderEditor = () => {
    switch (block.type) {
      case 'code':
        return (
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Language</label>
              <select
                value={block.language || 'text'}
                onChange={(e) => onChange({ language: e.target.value })}
                className={inputClass}
              >
                {['typescript', 'javascript', 'python', 'bash', 'html', 'css', 'json', 'sql', 'text'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Code</label>
              <textarea
                value={block.content}
                onChange={(e) => onChange({ content: e.target.value })}
                className={`${inputClass} font-mono min-h-[120px] resize-y`}
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Image URL</label>
              <input value={block.src || ''} onChange={(e) => onChange({ src: e.target.value })} className={inputClass} placeholder="https://..." />
            </div>
            <div>
              <label className={labelClass}>Alt Text</label>
              <input value={block.alt || ''} onChange={(e) => onChange({ alt: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Caption</label>
              <input value={block.caption || ''} onChange={(e) => onChange({ caption: e.target.value })} className={inputClass} />
            </div>
          </div>
        );

      case 'embed':
        return (
          <div>
            <label className={labelClass}>Video URL</label>
            <input value={block.url || ''} onChange={(e) => onChange({ url: e.target.value })} className={inputClass} placeholder="YouTube, Loom, or Vimeo URL" />
          </div>
        );

      case 'accordion':
        return (
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Title</label>
              <input value={block.title || ''} onChange={(e) => onChange({ title: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Content</label>
              <textarea value={block.content} onChange={(e) => onChange({ content: e.target.value })} className={`${inputClass} min-h-[80px] resize-y`} />
            </div>
          </div>
        );

      case 'numbered-item':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="w-16">
                <label className={labelClass}>Number</label>
                <input type="number" value={block.number ?? 1} onChange={(e) => onChange({ number: parseInt(e.target.value) || 1 })} className={`${inputClass} text-center`} />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Title</label>
                <input value={block.title || ''} onChange={(e) => onChange({ title: e.target.value })} className={inputClass} />
              </div>
              <div className="w-28">
                <label className={labelClass}>Category</label>
                <input value={block.category || ''} onChange={(e) => onChange({ category: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea value={block.content} onChange={(e) => onChange({ content: e.target.value })} className={`${inputClass} min-h-[60px] resize-y`} />
            </div>
            <div>
              <label className={labelClass}>Detail (Read more)</label>
              <textarea value={block.detail || ''} onChange={(e) => onChange({ detail: e.target.value })} className={`${inputClass} min-h-[60px] resize-y`} />
            </div>
          </div>
        );

      case 'stat-card':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelClass}>Stat Value</label>
                <input value={block.content} onChange={(e) => onChange({ content: e.target.value })} className={inputClass} placeholder="35%, 2.3x..." />
              </div>
              <div className="w-24">
                <label className={labelClass}>Style</label>
                <select value={block.style || 'info'} onChange={(e) => onChange({ style: e.target.value as CalloutStyle })} className={inputClass}>
                  <option value="info">Blue</option>
                  <option value="warning">Amber</option>
                  <option value="success">Green</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input value={block.title || ''} onChange={(e) => onChange({ title: e.target.value })} className={inputClass} />
            </div>
          </div>
        );

      case 'table':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button onClick={() => {
                const headers = [...(block.headers || []), `Column ${(block.headers?.length || 0) + 1}`];
                const rows = (block.rows || []).map((row) => [...row, '']);
                onChange({ headers, rows });
              }} className="rounded border px-2 py-1 text-xs hover:bg-muted">+ Column</button>
              <button onClick={() => {
                const cols = block.headers?.length || 2;
                const rows = [...(block.rows || []), Array(cols).fill('')];
                onChange({ rows });
              }} className="rounded border px-2 py-1 text-xs hover:bg-muted">+ Row</button>
            </div>
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {(block.headers || []).map((h, i) => (
                      <th key={i} className="p-1">
                        <input value={h} onChange={(e) => {
                          const headers = [...(block.headers || [])];
                          headers[i] = e.target.value;
                          onChange({ headers });
                        }} className={`${inputClass} font-semibold`} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(block.rows || []).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="p-1">
                          <input value={cell} onChange={(e) => {
                            const rows = (block.rows || []).map((r, idx) =>
                              idx === ri ? r.map((c, cidx) => cidx === ci ? e.target.value : c) : [...r]
                            );
                            onChange({ rows });
                          }} className={inputClass} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !showEditor && setIsHovered(false)}
    >
      {/* Gear icon */}
      <button
        onClick={() => setShowEditor(!showEditor)}
        className="absolute -right-2 -top-2 z-10 rounded-full border bg-popover p-1 shadow-sm transition-opacity duration-150 hover:bg-muted"
        style={{ opacity: isHovered || showEditor ? 1 : 0, pointerEvents: isHovered || showEditor ? 'auto' : 'none' }}
        title="Edit block"
      >
        <Settings size={14} className="text-muted-foreground" />
      </button>

      {/* Editor popover */}
      {showEditor && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-8 z-50 w-[400px] rounded-lg border bg-popover p-4 shadow-xl"
        >
          {renderEditor()}
        </div>
      )}

      {/* Published block rendering */}
      {children}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content/inline-editor/StructuredBlockOverlay.tsx
git commit -m "feat: add StructuredBlockOverlay with gear icon popover for structured blocks"
```

---

### Task 6: SlashCommandMenu Component

Slash command menu triggered by `/` in empty blocks. Uses TipTap's Suggestion plugin pattern but implemented as a standalone React component (since each text block is a separate TipTap instance in our architecture).

**Files:**
- Create: `src/components/content/inline-editor/SlashCommandMenu.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Type, AlertCircle, List, Quote, Minus, Code, Table, ChevronRight,
  BarChart3, Image, Play, MessageSquare, Hash,
} from 'lucide-react';
import type { PolishedBlockType, CalloutStyle } from '@/lib/types/lead-magnet';

interface BlockOption {
  type: PolishedBlockType;
  label: string;
  icon: React.ElementType;
  style?: CalloutStyle;
  description: string;
}

const BLOCK_OPTIONS: BlockOption[] = [
  { type: 'paragraph', label: 'Paragraph', icon: Type, description: 'Plain text block' },
  { type: 'list', label: 'Bullet List', icon: List, description: 'Simple bulleted list' },
  { type: 'quote', label: 'Quote', icon: Quote, description: 'Blockquote' },
  { type: 'callout', label: 'Info Callout', icon: AlertCircle, style: 'info', description: 'Blue info box' },
  { type: 'callout', label: 'Warning', icon: AlertCircle, style: 'warning', description: 'Amber warning box' },
  { type: 'callout', label: 'Success', icon: AlertCircle, style: 'success', description: 'Green success box' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal rule' },
  { type: 'code', label: 'Code Block', icon: Code, description: 'Syntax-highlighted code' },
  { type: 'table', label: 'Table', icon: Table, description: 'Data table with headers' },
  { type: 'accordion', label: 'Accordion', icon: ChevronRight, description: 'Collapsible section' },
  { type: 'numbered-item', label: 'Numbered Item', icon: Hash, description: 'Numbered card with detail' },
  { type: 'stat-card', label: 'Stat Card', icon: BarChart3, description: 'Big number highlight' },
  { type: 'image', label: 'Image', icon: Image, description: 'Image with caption' },
  { type: 'embed', label: 'Video Embed', icon: Play, description: 'YouTube, Loom, Vimeo' },
];

interface SlashCommandMenuProps {
  isOpen: boolean;
  onSelect: (type: PolishedBlockType, style?: CalloutStyle) => void;
  onClose: () => void;
  /** Position the menu near this element */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function SlashCommandMenu({ isOpen, onSelect, onClose, anchorRef }: SlashCommandMenuProps) {
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = BLOCK_OPTIONS.filter(opt =>
    opt.label.toLowerCase().includes(filter.toLowerCase()) ||
    opt.description.toLowerCase().includes(filter.toLowerCase())
  );

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setFilter('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) onSelect(option.type, option.style);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, activeIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="z-50 w-[280px] max-h-[320px] overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl"
    >
      <input
        ref={inputRef}
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setActiveIndex(0); }}
        onKeyDown={handleKeyDown}
        placeholder="Filter blocks..."
        className="mb-1 w-full rounded border-0 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      {filtered.map((opt, idx) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.type, opt.style)}
            className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors ${
              idx === activeIndex ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
            }`}
            onMouseEnter={() => setActiveIndex(idx)}
          >
            <Icon size={16} className="shrink-0" />
            <div>
              <div className="font-medium text-foreground">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.description}</div>
            </div>
          </button>
        );
      })}
      {filtered.length === 0 && (
        <div className="px-2 py-3 text-center text-xs text-muted-foreground">No blocks match</div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content/inline-editor/SlashCommandMenu.tsx
git commit -m "feat: add SlashCommandMenu with filterable block type picker"
```

---

### Task 7: InlineContentEditor — Main Component

The central orchestrator. Replaces `EditablePolishedContentRenderer` in `ContentPageClient`. Renders each section and block using the components from tasks 3-6, dispatching to `TipTapTextBlock` for text blocks and `StructuredBlockOverlay` for structured blocks.

**Files:**
- Create: `src/components/content/inline-editor/InlineContentEditor.tsx`
- Create: `src/components/content/inline-editor/index.ts` (barrel export)

**Step 1: Create the barrel export**

Create `src/components/content/inline-editor/index.ts`:

```typescript
export { InlineContentEditor } from './InlineContentEditor';
```

**Step 2: Create InlineContentEditor**

This is the largest component. It wires together:
- `TipTapTextBlock` for paragraph/callout/list/quote blocks + section intro/takeaway
- `StructuredBlockOverlay` wrapping the existing read-only `ContentBlocks` for structured blocks
- `BlockHoverControls` around every block
- `SlashCommandMenu` triggered by `/` in empty paragraphs
- Section add/delete/move controls on hover between sections
- `contentEditable` for section headings (simple single-line, no TipTap needed)

Create `src/components/content/inline-editor/InlineContentEditor.tsx`:

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { PolishedContent, PolishedSection, PolishedBlock, PolishedBlockType, CalloutStyle } from '@/lib/types/lead-magnet';
import { Callout, RichParagraph, BulletList, BlockQuote, SectionDivider, CodeBlock, TableBlock, AccordionBlock, ImageBlock, EmbedBlock, NumberedItem, StatCard } from '../ContentBlocks';
import { TipTapTextBlock } from './TipTapTextBlock';
import { BlockHoverControls } from './BlockHoverControls';
import { StructuredBlockOverlay } from './StructuredBlockOverlay';
import { SlashCommandMenu } from './SlashCommandMenu';

interface InlineContentEditorProps {
  content: PolishedContent;
  isDark: boolean;
  primaryColor: string;
  onChange: (content: PolishedContent) => void;
}

// Block types that use TipTap inline editing
const TEXT_BLOCK_TYPES = new Set<PolishedBlockType>(['paragraph', 'callout', 'list', 'quote']);

// Block types that use structured overlay editing
const STRUCTURED_BLOCK_TYPES = new Set<PolishedBlockType>([
  'code', 'table', 'accordion', 'numbered-item', 'stat-card', 'image', 'embed',
]);

function createDefaultBlock(type: PolishedBlockType, style?: CalloutStyle): PolishedBlock {
  switch (type) {
    case 'code': return { type: 'code', content: '// Your code here', language: 'typescript' };
    case 'table': return { type: 'table', content: '', headers: ['Column 1', 'Column 2'], rows: [['', '']] };
    case 'accordion': return { type: 'accordion', content: 'Content here...', title: 'Click to expand' };
    case 'numbered-item': return { type: 'numbered-item', content: 'Description...', title: 'Item Title', number: 1 };
    case 'stat-card': return { type: 'stat-card', content: '0%', title: 'Stat description' };
    case 'image': return { type: 'image', content: '', src: '', alt: '' };
    case 'embed': return { type: 'embed', content: '', url: '' };
    case 'divider': return { type: 'divider', content: '' };
    default: return { type, content: '', ...(style ? { style } : {}) };
  }
}

export function InlineContentEditor({ content, isDark, primaryColor, onChange }: InlineContentEditorProps) {
  const [slashMenuState, setSlashMenuState] = useState<{ sectionIdx: number; blockIdx: number } | null>(null);
  const [hoveredSectionGap, setHoveredSectionGap] = useState<number | null>(null);

  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const bodyColor = isDark ? '#E4E4E7' : '#27272A';
  const mutedColor = isDark ? '#A1A1AA' : '#71717A';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const cardBg = isDark ? '#18181B' : '#FFFFFF';
  const colors = { text: textColor, body: bodyColor, muted: mutedColor, border: borderColor, card: cardBg };

  // ─── Mutation helpers ───────────────────────────────────────────

  const updateSection = useCallback((sectionIdx: number, updates: Partial<PolishedSection>) => {
    const newSections = [...content.sections];
    newSections[sectionIdx] = { ...newSections[sectionIdx], ...updates };
    onChange({ ...content, sections: newSections });
  }, [content, onChange]);

  const updateBlock = useCallback((sectionIdx: number, blockIdx: number, updates: Partial<PolishedBlock>) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    newBlocks[blockIdx] = { ...newBlocks[blockIdx], ...updates };
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  }, [content, onChange]);

  const addBlock = useCallback((sectionIdx: number, afterBlockIdx: number, type: PolishedBlockType, style?: CalloutStyle) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    newBlocks.splice(afterBlockIdx + 1, 0, createDefaultBlock(type, style));
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
    setSlashMenuState(null);
  }, [content, onChange]);

  const deleteBlock = useCallback((sectionIdx: number, blockIdx: number) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    if (newBlocks.length <= 1) return; // Keep at least one block
    newBlocks.splice(blockIdx, 1);
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  }, [content, onChange]);

  const moveBlock = useCallback((sectionIdx: number, blockIdx: number, direction: 'up' | 'down') => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (targetIdx < 0 || targetIdx >= newBlocks.length) return;
    [newBlocks[blockIdx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[blockIdx]];
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  }, [content, onChange]);

  const addSection = useCallback((afterIdx: number) => {
    const newSections = [...content.sections];
    newSections.splice(afterIdx + 1, 0, {
      id: `section-${Date.now()}`,
      sectionName: 'New Section',
      introduction: '',
      blocks: [{ type: 'paragraph', content: '' }],
      keyTakeaway: '',
    });
    onChange({ ...content, sections: newSections });
  }, [content, onChange]);

  const deleteSection = useCallback((sectionIdx: number) => {
    if (content.sections.length <= 1) return;
    const newSections = [...content.sections];
    newSections.splice(sectionIdx, 1);
    onChange({ ...content, sections: newSections });
  }, [content, onChange]);

  const moveSection = useCallback((sectionIdx: number, direction: 'up' | 'down') => {
    const newSections = [...content.sections];
    const targetIdx = direction === 'up' ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    [newSections[sectionIdx], newSections[targetIdx]] = [newSections[targetIdx], newSections[sectionIdx]];
    onChange({ ...content, sections: newSections });
  }, [content, onChange]);

  // ─── Slash command detection ────────────────────────────────────

  const handleTextBlockChange = useCallback((sectionIdx: number, blockIdx: number, newContent: string) => {
    if (newContent === '/') {
      setSlashMenuState({ sectionIdx, blockIdx });
      return;
    }
    setSlashMenuState(null);
    updateBlock(sectionIdx, blockIdx, { content: newContent });
  }, [updateBlock]);

  const handleSlashSelect = useCallback((type: PolishedBlockType, style?: CalloutStyle) => {
    if (!slashMenuState) return;
    const { sectionIdx, blockIdx } = slashMenuState;
    // Clear the slash from the current block
    updateBlock(sectionIdx, blockIdx, { content: '' });
    // If we're replacing an empty paragraph, change its type
    const currentBlock = content.sections[sectionIdx].blocks[blockIdx];
    if (currentBlock.type === 'paragraph' && !currentBlock.content.replace('/', '').trim()) {
      const newBlock = createDefaultBlock(type, style);
      updateBlock(sectionIdx, blockIdx, newBlock);
    } else {
      addBlock(sectionIdx, blockIdx, type, style);
    }
    setSlashMenuState(null);
  }, [slashMenuState, content, updateBlock, addBlock]);

  // ─── Block renderer ─────────────────────────────────────────────

  const renderBlock = (block: PolishedBlock, sectionIdx: number, blockIdx: number) => {
    // Divider — no editing
    if (block.type === 'divider') {
      return <SectionDivider colors={colors} />;
    }

    // Text blocks → TipTap
    if (TEXT_BLOCK_TYPES.has(block.type)) {
      const textStyle: React.CSSProperties = {
        fontSize: '1.125rem',
        lineHeight: '1.875rem',
        color: bodyColor,
      };

      const editor = (
        <TipTapTextBlock
          content={block.content}
          onChange={(val) => handleTextBlockChange(sectionIdx, blockIdx, val)}
          placeholder={`Type / for commands...`}
          style={textStyle}
        />
      );

      // Wrap callouts and quotes in their visual containers
      if (block.type === 'callout') {
        const calloutStyle = block.style || 'info';
        const calloutConfig: Record<string, { bg: string; border: string }> = {
          info: { bg: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)', border: '#3b82f6' },
          warning: { bg: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)', border: '#f59e0b' },
          success: { bg: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)', border: '#22c55e' },
        };
        const cfg = calloutConfig[calloutStyle] || calloutConfig.info;
        return (
          <div style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.border}`, borderRadius: '0.5rem', padding: '1rem 1.25rem', margin: '1.5rem 0' }}>
            {editor}
          </div>
        );
      }

      if (block.type === 'quote') {
        return (
          <blockquote style={{ borderLeft: `3px solid ${primaryColor}`, paddingLeft: '1.25rem', margin: '1.5rem 0', fontStyle: 'italic' }}>
            {editor}
          </blockquote>
        );
      }

      // paragraph and list render directly
      return <div style={{ margin: '1.25rem 0' }}>{editor}</div>;
    }

    // Structured blocks → published view + overlay
    if (STRUCTURED_BLOCK_TYPES.has(block.type)) {
      const publishedView = renderPublishedBlock(block);
      return (
        <StructuredBlockOverlay
          block={block}
          onChange={(updates) => updateBlock(sectionIdx, blockIdx, updates)}
          isDark={isDark}
          primaryColor={primaryColor}
        >
          {publishedView}
        </StructuredBlockOverlay>
      );
    }

    return null;
  };

  const renderPublishedBlock = (block: PolishedBlock) => {
    switch (block.type) {
      case 'code': return <CodeBlock block={block} isDark={isDark} />;
      case 'table': return <TableBlock block={block} isDark={isDark} />;
      case 'accordion': return <AccordionBlock block={block} />;
      case 'image': return <ImageBlock block={block} />;
      case 'embed': return <EmbedBlock block={block} />;
      case 'numbered-item': return <NumberedItem block={block} colors={colors} primaryColor={primaryColor} isDark={isDark} />;
      case 'stat-card': return <StatCard block={block} isDark={isDark} primaryColor={primaryColor} />;
      default: return null;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="inline-content-editor pl-10">
      {/* Hero Summary */}
      <div style={{ marginBottom: '2rem' }}>
        <TipTapTextBlock
          content={content.heroSummary}
          onChange={(val) => onChange({ ...content, heroSummary: val })}
          placeholder="A compelling 1-2 sentence summary..."
          style={{ fontSize: '1.125rem', lineHeight: '1.75rem', color: bodyColor }}
        />
      </div>

      {/* Sections */}
      {content.sections.map((section, sectionIdx) => (
        <section key={section.id} id={`section-${section.id}`} style={{ marginBottom: '3rem', scrollMarginTop: '5rem' }}>
          {/* Section heading — contentEditable */}
          <h2
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateSection(sectionIdx, { sectionName: e.currentTarget.textContent || 'Untitled' })}
            style={{
              fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em',
              lineHeight: '2rem', color: textColor, margin: '0 0 0.75rem 0',
              outline: 'none', cursor: 'text',
            }}
          >
            {section.sectionName}
          </h2>

          {/* Section introduction */}
          <div style={{ margin: '0 0 1.5rem 0', fontStyle: 'italic' }}>
            <TipTapTextBlock
              content={section.introduction}
              onChange={(val) => updateSection(sectionIdx, { introduction: val })}
              placeholder="Section introduction (optional)"
              style={{ fontSize: '1.125rem', lineHeight: '1.875rem', color: mutedColor }}
            />
          </div>

          {/* Blocks */}
          {section.blocks.map((block, blockIdx) => (
            <div key={blockIdx} className="relative">
              <BlockHoverControls
                blockType={block.type}
                onMoveUp={() => moveBlock(sectionIdx, blockIdx, 'up')}
                onMoveDown={() => moveBlock(sectionIdx, blockIdx, 'down')}
                onDelete={() => deleteBlock(sectionIdx, blockIdx)}
                canMoveUp={blockIdx > 0}
                canMoveDown={blockIdx < section.blocks.length - 1}
              >
                {renderBlock(block, sectionIdx, blockIdx)}
              </BlockHoverControls>

              {/* Slash command menu anchored to this block */}
              {slashMenuState?.sectionIdx === sectionIdx && slashMenuState?.blockIdx === blockIdx && (
                <div className="relative">
                  <SlashCommandMenu
                    isOpen
                    onSelect={handleSlashSelect}
                    onClose={() => setSlashMenuState(null)}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Key takeaway */}
          {(section.keyTakeaway || true) && (
            <div style={{ marginTop: '1rem' }}>
              <TipTapTextBlock
                content={section.keyTakeaway}
                onChange={(val) => updateSection(sectionIdx, { keyTakeaway: val })}
                placeholder="Key takeaway for this section (optional)"
                style={{ fontSize: '1rem', lineHeight: '1.75rem', color: bodyColor }}
              />
            </div>
          )}

          {/* Section divider with add section button */}
          <div
            className="group relative flex items-center gap-4 mt-8"
            onMouseEnter={() => setHoveredSectionGap(sectionIdx)}
            onMouseLeave={() => setHoveredSectionGap(null)}
          >
            <hr className="flex-1" style={{ border: 'none', borderTop: `1px solid ${borderColor}` }} />
            <button
              onClick={() => addSection(sectionIdx)}
              className="flex items-center gap-1 rounded px-3 py-1 text-xs transition-opacity duration-150 hover:bg-muted"
              style={{
                color: mutedColor,
                border: `1px dashed ${borderColor}`,
                opacity: hoveredSectionGap === sectionIdx ? 1 : 0,
              }}
            >
              <Plus size={12} /> Add section
            </button>
            <hr className="flex-1" style={{ border: 'none', borderTop: `1px solid ${borderColor}` }} />
          </div>
        </section>
      ))}
    </div>
  );
}
```

**Step 3: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | grep "inline-editor" | head -10`
Expected: No errors for inline-editor files

**Step 4: Commit**

```bash
git add src/components/content/inline-editor/
git commit -m "feat: add InlineContentEditor orchestrator component"
```

---

### Task 8: Wire InlineContentEditor into ContentPageClient

Replace `EditablePolishedContentRenderer` with `InlineContentEditor` in the content page. Add `?edit=true` URL param support.

**Files:**
- Modify: `src/components/content/ContentPageClient.tsx:1-10` (imports)
- Modify: `src/components/content/ContentPageClient.tsx:203-210` (editor swap)
- Modify: `src/app/p/[username]/[slug]/content/page.tsx` (pass ?edit param)

**Step 1: Update ContentPageClient imports and editor rendering**

In `src/components/content/ContentPageClient.tsx`:

1. Replace the import of `EditablePolishedContentRenderer` with `InlineContentEditor`:

```typescript
// REMOVE this line:
import { EditablePolishedContentRenderer } from './EditablePolishedContentRenderer';
// ADD this line:
import { InlineContentEditor } from './inline-editor';
```

2. In the content rendering area (~line 203), replace:

```typescript
// BEFORE:
<EditablePolishedContentRenderer
  content={editContent}
  isDark={isDark}
  primaryColor={primaryColor}
  onChange={setEditContent}
/>

// AFTER:
<InlineContentEditor
  content={editContent}
  isDark={isDark}
  primaryColor={primaryColor}
  onChange={setEditContent}
/>
```

3. Add support for `?edit=true` auto-entry. Add a new prop `autoEdit?: boolean` to `ContentPageClientProps` and use it:

```typescript
// In the component, after existing useState declarations:
const [isEditing, setIsEditing] = useState(autoEdit && isOwner);
```

**Step 2: Pass autoEdit from the server page**

In `src/app/p/[username]/[slug]/content/page.tsx`, update searchParams:

```typescript
// Update the searchParams type:
searchParams: Promise<{ leadId?: string; edit?: string }>;

// Destructure:
const { leadId, edit } = await searchParams;

// Pass to ContentPageClient:
autoEdit={edit === 'true'}
```

**Step 3: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | grep -E "ContentPageClient|content/page" | head -10`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/components/content/ContentPageClient.tsx src/app/p/[username]/[slug]/content/page.tsx
git commit -m "feat: wire InlineContentEditor into content page with ?edit=true support"
```

---

### Task 9: Simplify ContentPageTab (Funnel Builder)

Replace the batch editor in the Content tab with a simplified status + redirect view.

**Files:**
- Modify: `src/components/funnel/ContentPageTab.tsx`

**Step 1: Rewrite ContentPageTab**

Replace the entire component. Keep: AI generation, blank creation, content status display, and "Edit Content" button that links to the live page. Remove: the `EditablePolishedContentRenderer` import and inline editor.

The "Edit Content" button navigates to `/p/{username}/{slug}/content?edit=true`.

Key changes:
- Remove import of `EditablePolishedContentRenderer`
- Remove `isEditing`, `editContent`, `saving` state
- Remove `handleStartEditing`, `handleDiscard`, `handleSave`
- Remove the `if (isEditing && editContent)` branch
- Change the "Edit Content" button to an `<a>` link to the content page with `?edit=true`

The "has polished content" state should show:
1. "Open Content Page" link (existing)
2. Content status card (sections, word count, reading time) — existing
3. "Edit Content" link → navigates to `{contentUrl}?edit=true` in same tab
4. "Re-polish Content" button (existing, when extracted content exists)

**Step 2: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | grep ContentPageTab | head -5`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/funnel/ContentPageTab.tsx
git commit -m "feat: simplify ContentPageTab to redirect to inline editor"
```

---

### Task 10: TipTap Editor Styles

TipTap renders its own DOM elements that need to match the content page's existing typography. Add minimal CSS to ensure TipTap content looks identical to `PolishedContentRenderer` output.

**Files:**
- Create: `src/components/content/inline-editor/tiptap-styles.css`
- Modify: `src/components/content/inline-editor/InlineContentEditor.tsx` (import CSS)

**Step 1: Create styles**

Create `src/components/content/inline-editor/tiptap-styles.css`:

```css
/* TipTap inline editor styles — match PolishedContentRenderer typography */

.tiptap-text-block .tiptap {
  outline: none;
}

.tiptap-text-block .tiptap p {
  margin: 0;
}

.tiptap-text-block .tiptap a {
  color: var(--ds-primary, #8b5cf6);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tiptap-text-block .tiptap a:hover {
  opacity: 0.8;
}

/* Placeholder styling */
.tiptap-text-block .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--ds-muted, #a1a1aa);
  pointer-events: none;
  height: 0;
  font-style: italic;
}

/* Bubble menu transitions */
.tippy-box[data-animation='fade'][data-state='hidden'] {
  opacity: 0;
}
```

**Step 2: Import in InlineContentEditor**

Add to the top of `InlineContentEditor.tsx`:

```typescript
import './tiptap-styles.css';
```

**Step 3: Commit**

```bash
git add src/components/content/inline-editor/tiptap-styles.css src/components/content/inline-editor/InlineContentEditor.tsx
git commit -m "feat: add TipTap editor styles to match content page typography"
```

---

### Task 11: Manual Testing & Polish

Test the full flow end-to-end and fix visual issues.

**Step 1: Start dev server**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run dev`

**Step 2: Test flow**

1. Navigate to a lead magnet content page as the owner
2. Click the edit pencil → verify inline editor appears
3. Edit a paragraph → verify text renders in-place (not in a textarea)
4. Select text → verify bold/italic/link toolbar appears
5. Type `/` in an empty block → verify slash command menu
6. Add a new block via slash command → verify it appears
7. Hover a block → verify gutter controls appear
8. Move/delete blocks via gutter menu
9. Click gear on a structured block (table, image) → verify popover editor
10. Click Save → verify content saves and page returns to read-only

**Step 3: Test ?edit=true entry**

1. Navigate to funnel builder → Content tab
2. Click "Edit Content" → verify redirect to content page in edit mode

**Step 4: Test team member access**

1. Log in as a different team member
2. Navigate to a teammate's content page
3. Verify edit button appears and editing works

**Step 5: Fix issues found during testing**

Address any visual alignment, z-index, or interaction issues discovered.

**Step 6: Commit**

```bash
git add -A
git commit -m "fix: polish inline editor visual issues from manual testing"
```

---

### Task 12: Typecheck & Lint

**Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | grep -v "suggest-lead-magnet-topics.test" | head -20`
Expected: No new type errors

**Step 2: Run lint**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run lint 2>&1 | tail -10`
Expected: Clean or only pre-existing warnings

**Step 3: Run existing tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage 2>&1 | tail -10`
Expected: All tests pass (including new serializer tests)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues"
```
