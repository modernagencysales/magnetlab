/** PromptInput. Auto-resizing textarea for copilot conversation. Constraint: No fetch calls, pure UI. */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PromptInputProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  autoFocus?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 200;

// ─── Component ──────────────────────────────────────────────────────────────────

export function PromptInput({
  onSubmit,
  onCancel,
  isStreaming,
  autoFocus = false,
}: PromptInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Auto-resize ────────────────────────────────────────────────────────────

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [text, resize]);

  // ─── Auto-focus ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    onSubmit(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything..."
        disabled={isStreaming}
        rows={1}
        className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
      />

      <div className="absolute right-2 bottom-2">
        {isStreaming ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCancel}
            className="text-destructive hover:bg-destructive/10"
            aria-label="Stop generating"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            disabled={!text.trim()}
            className="text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
