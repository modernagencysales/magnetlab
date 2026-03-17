'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Bold, Italic, Strikethrough, Link as LinkIcon, Unlink } from 'lucide-react';
import {
  markdownToTiptapDoc,
  tiptapDocToMarkdown,
  type TiptapDoc,
} from '@/lib/utils/tiptap-serializer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TipTapTextBlockProps {
  content: string; // Markdown string from PolishedBlock.content
  onChange: (content: string) => void;
  onCharacterCount?: (count: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean; // Allow Enter key (default true)
}

// ---------------------------------------------------------------------------
// Bubble Menu – Link URL Input
// ---------------------------------------------------------------------------

interface LinkInputProps {
  initialUrl: string;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}

function LinkInput({ initialUrl, onSubmit, onCancel }: LinkInputProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(url);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="https://..."
        className="h-7 w-48 rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-violet-500"
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onSubmit(url);
        }}
        className="rounded px-2 py-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700"
      >
        Apply
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onCancel();
        }}
        className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubble Menu Toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
  editor: ReturnType<typeof useEditor>;
}

function BubbleToolbar({ editor }: ToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);

  if (!editor) return null;

  const isLink = editor.isActive('link');

  const handleSetLink = (url: string) => {
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setShowLinkInput(false);
  };

  const handleUnlink = () => {
    editor.chain().focus().unsetLink().run();
    setShowLinkInput(false);
  };

  const handleLinkClick = () => {
    if (isLink) {
      handleUnlink();
    } else {
      setShowLinkInput(true);
    }
  };

  if (showLinkInput) {
    const existingHref = (editor.getAttributes('link').href as string) || '';
    return (
      <LinkInput
        initialUrl={existingHref}
        onSubmit={handleSetLink}
        onCancel={() => setShowLinkInput(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
        className={`rounded p-1.5 transition-colors ${
          editor.isActive('bold')
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
            : 'text-muted-foreground hover:bg-muted'
        }`}
        aria-label="Bold"
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleItalic().run();
        }}
        className={`rounded p-1.5 transition-colors ${
          editor.isActive('italic')
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
            : 'text-muted-foreground hover:bg-muted'
        }`}
        aria-label="Italic"
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleStrike().run();
        }}
        className={`rounded p-1.5 transition-colors ${
          editor.isActive('strike')
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
            : 'text-muted-foreground hover:bg-muted'
        }`}
        aria-label="Strikethrough"
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </button>

      <div className="mx-0.5 h-4 w-px bg-border" />

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          handleLinkClick();
        }}
        className={`rounded p-1.5 transition-colors ${
          isLink
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
            : 'text-muted-foreground hover:bg-muted'
        }`}
        aria-label={isLink ? 'Unlink' : 'Link'}
        title={isLink ? 'Remove link' : 'Add link'}
      >
        {isLink ? <Unlink className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TipTapTextBlock Component
// ---------------------------------------------------------------------------

export function TipTapTextBlock({
  content,
  onChange,
  onCharacterCount,
  placeholder: placeholderText,
  className,
  style,
  multiline = true,
}: TipTapTextBlockProps) {
  // Use a ref for onChange so we don't recreate the editor on every render
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const onCharacterCountRef = useRef(onCharacterCount);
  useEffect(() => {
    onCharacterCountRef.current = onCharacterCount;
  }, [onCharacterCount]);

  // Track the last content we set to avoid infinite loops when syncing
  const lastContentRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({
        placeholder: placeholderText || 'Start typing...',
      }),
      CharacterCount,
    ],
    content: markdownToTiptapDoc(content) as JSONContent,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (!multiline && event.key === 'Enter') {
          return true; // Prevent Enter key
        }
        return false;
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const markdown = tiptapDocToMarkdown(updatedEditor.getJSON() as unknown as TiptapDoc);
      lastContentRef.current = markdown;
      onChangeRef.current(markdown);
      if (onCharacterCountRef.current) {
        onCharacterCountRef.current(markdown.length);
      }
    },
  });

  // Sync external content changes (e.g. AI regeneration)
  useEffect(() => {
    if (!editor) return;
    if (content === lastContentRef.current) return;

    lastContentRef.current = content;
    const newDoc = markdownToTiptapDoc(content) as JSONContent;
    editor.commands.setContent(newDoc);
  }, [content, editor]);

  // Reset the link input state when the bubble menu closes
  const handleBubbleMenuHide = useCallback(() => {
    // BubbleMenu manages its own visibility; no action needed here
  }, []);

  return (
    <div className={`tiptap-text-block ${className || ''}`} style={style}>
      {editor && (
        <BubbleMenu
          editor={editor}
          options={{
            placement: 'top',
            onHide: handleBubbleMenuHide,
          }}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <BubbleToolbar editor={editor} />
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

export default TipTapTextBlock;
