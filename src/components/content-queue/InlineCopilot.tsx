/**
 * InlineCopilot.
 * Compact chat UI for the content queue's right panel (260px).
 * Includes message area, diff preview for proposed edits, and prompt input.
 * Never fetches data directly — delegates to useInlineCopilot hook.
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Square, Check, X } from 'lucide-react';
import { useInlineCopilot } from './useInlineCopilot';
import type { QueueTeamWritingStyle, QueuePostReviewData } from '@/frontend/api/content-queue';

// ─── Types ──────────────────────────────────────────────────────────────────

interface InlineCopilotProps {
  postId: string;
  postContent: string;
  teamName: string;
  authorName: string;
  writingStyle: QueueTeamWritingStyle | null;
  reviewData: QueuePostReviewData | null;
  onContentUpdated: (newContent: string) => void;
}

// ─── Diff Helpers ───────────────────────────────────────────────────────────

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

function computeLineDiff(original: string, proposed: string): DiffLine[] {
  const origLines = original.split('\n');
  const propLines = proposed.split('\n');
  const result: DiffLine[] = [];

  const maxLen = Math.max(origLines.length, propLines.length);
  let oi = 0;
  let pi = 0;

  while (oi < origLines.length || pi < propLines.length) {
    if (oi < origLines.length && pi < propLines.length) {
      if (origLines[oi] === propLines[pi]) {
        result.push({ type: 'unchanged', text: origLines[oi] });
        oi++;
        pi++;
      } else {
        // Look ahead to find matching line
        let foundInProposed = -1;
        for (let j = pi + 1; j < Math.min(pi + 5, propLines.length); j++) {
          if (origLines[oi] === propLines[j]) {
            foundInProposed = j;
            break;
          }
        }

        if (foundInProposed >= 0) {
          // Added lines before the match
          for (let j = pi; j < foundInProposed; j++) {
            result.push({ type: 'added', text: propLines[j] });
          }
          pi = foundInProposed;
        } else {
          result.push({ type: 'removed', text: origLines[oi] });
          result.push({ type: 'added', text: propLines[pi] });
          oi++;
          pi++;
        }
      }
    } else if (oi < origLines.length) {
      result.push({ type: 'removed', text: origLines[oi] });
      oi++;
    } else if (pi < propLines.length) {
      result.push({ type: 'added', text: propLines[pi] });
      pi++;
    }

    // Safety: cap at reasonable length
    if (result.length > maxLen + 50) break;
  }

  return result;
}

// ─── Diff Preview Component ────────────────────────────────────────────────

function DiffPreview({
  original,
  proposed,
  onAccept,
  onReject,
}: {
  original: string;
  proposed: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  const lines = computeLineDiff(original, proposed);

  return (
    <div className="mx-2 mb-2 rounded-lg border border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30">
      <div className="flex items-center justify-between border-b border-violet-200 px-3 py-1.5 dark:border-violet-800">
        <span className="text-[10px] font-medium uppercase text-violet-600 dark:text-violet-400">
          Proposed changes
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReject}
            className="rounded p-1 text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
            title="Reject"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded p-1 text-emerald-600 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            title="Accept"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto px-2 py-1.5 font-mono text-[10px] leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.type === 'added'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : line.type === 'removed'
                  ? 'bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-300'
                  : 'text-muted-foreground'
            }
          >
            <span className="mr-1 select-none opacity-50">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Streaming Indicator ────────────────────────────────────────────────────

function StreamingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InlineCopilot({
  postId,
  postContent,
  teamName,
  authorName,
  onContentUpdated,
}: InlineCopilotProps) {
  const {
    messages,
    isStreaming,
    error,
    pendingEdit,
    sendMessage,
    acceptEdit,
    rejectEdit,
    cancelStream,
  } = useInlineCopilot({ postId, postContent, teamName, authorName });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingEdit]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 120)}px`;
  }, [inputText]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || isStreaming) return;
      sendMessage(inputText.trim());
      setInputText('');
    },
    [inputText, isStreaming, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  const handleAccept = useCallback(async () => {
    const content = await acceptEdit();
    if (content) {
      onContentUpdated(content);
    }
  }, [acceptEdit, onContentUpdated]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const visibleMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {visibleMessages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">Ask the AI to edit this post</p>
            <div className="flex flex-col gap-1">
              {['Make the hook stronger', 'Add line breaks', 'Make it more conversational'].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-violet-300 hover:text-violet-600 dark:hover:border-violet-700 dark:hover:text-violet-400"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-2 py-2">
            {visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-4 self-end bg-violet-600 text-white'
                    : 'mr-2 self-start text-foreground'
                }`}
              >
                {msg.content || (isStreaming ? '' : '...')}
              </div>
            ))}
            {isStreaming && <StreamingDots />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Diff preview */}
        {pendingEdit && (
          <DiffPreview
            original={postContent}
            proposed={pendingEdit.proposedContent}
            onAccept={handleAccept}
            onReject={rejectEdit}
          />
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-3 py-1.5 text-[10px] text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-2">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Edit this post..."
            disabled={isStreaming}
            rows={1}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
            style={{ minHeight: 36, maxHeight: 120 }}
          />
          <div className="absolute right-1.5 bottom-1.5">
            {isStreaming ? (
              <button
                type="button"
                onClick={cancelStream}
                className="rounded p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                title="Stop"
              >
                <Square className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="rounded p-1 text-violet-600 hover:bg-violet-100 disabled:opacity-30 dark:hover:bg-violet-900/30"
                title="Send"
              >
                <Send className="h-3 w-3" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
