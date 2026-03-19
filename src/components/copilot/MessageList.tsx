/** MessageList. Renders copilot messages with rich cards, auto-scroll, and inline confirmation. Constraint: No fetch calls, no streaming logic. */

'use client';

import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Wrench, Copy } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import { FeedbackWidget } from './FeedbackWidget';
import { PostPreviewCard } from './PostPreviewCard';
import { KnowledgeResultCard } from './KnowledgeResultCard';
import { IdeaListCard } from './IdeaListCard';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { CopilotMessage } from './CopilotProvider';
import type { PendingConfirmation } from './CopilotProvider';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: CopilotMessage[];
  pendingConfirmation: PendingConfirmation | null;
  onConfirm: (toolUseId: string, approved: boolean) => void;
  onFeedback: (messageId: string, rating: 'positive' | 'negative', note?: string) => void;
}

// ─── Clipboard Copy Handler ─────────────────────────────────────────────────────

function handleCopyToClipboard(_type: string, data: unknown) {
  const record = data as Record<string, unknown> | undefined;
  const text = (record?.content as string) ?? JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(text).catch(() => {
    /* clipboard API may not be available */
  });
}

// ─── Tool Call Pill ─────────────────────────────────────────────────────────────

function ToolCallMessage({ message }: { message: CopilotMessage }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Wrench className="w-3 h-3" />
        <span>
          Using <strong className="text-foreground">{message.toolName}</strong>...
        </span>
      </div>
    </div>
  );
}

// ─── Tool Result Card ───────────────────────────────────────────────────────────

function ToolResultMessage({ message }: { message: CopilotMessage }) {
  const result = message.toolResult;
  const resultData = (
    result && typeof result === 'object' && 'data' in result ? result.data : result
  ) as Record<string, unknown> | unknown[] | undefined;

  switch (message.displayHint) {
    case 'post_preview':
      return (
        <div className="my-2 max-w-2xl">
          <PostPreviewCard
            data={resultData as Parameters<typeof PostPreviewCard>[0]['data']}
            onApply={handleCopyToClipboard}
          />
        </div>
      );
    case 'knowledge_list':
      return (
        <div className="my-2 max-w-2xl">
          <KnowledgeResultCard
            data={resultData as Parameters<typeof KnowledgeResultCard>[0]['data']}
            onApply={handleCopyToClipboard}
          />
        </div>
      );
    case 'idea_list':
      return (
        <div className="my-2 max-w-2xl">
          <IdeaListCard
            data={resultData as Parameters<typeof IdeaListCard>[0]['data']}
            onApply={handleCopyToClipboard}
          />
        </div>
      );
    default:
      break;
  }

  const success = result && typeof result === 'object' && 'success' in result && result.success;
  return (
    <div
      className={`inline-block rounded-full px-3 py-1 text-xs ${
        success
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {success ? 'Done' : 'Failed'}: {message.toolName}
    </div>
  );
}

// ─── User Message ───────────────────────────────────────────────────────────────

function UserMessage({ message }: { message: CopilotMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[70%] rounded-2xl bg-primary/10 px-4 py-2 text-sm text-foreground whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  );
}

// ─── Assistant Message ──────────────────────────────────────────────────────────

function AssistantMessage({
  message,
  onFeedback,
}: {
  message: CopilotMessage;
  onFeedback: (rating: 'positive' | 'negative', note?: string) => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API may not be available */
    }
  };

  if (!message.content) return null;

  return (
    <div className="group">
      <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            code: ({ node, className, children, ...props }) => {
              const isBlock =
                className?.includes('language-') ||
                (node?.position && node.position.start.line !== node.position.end.line);
              if (isBlock) {
                return (
                  <code
                    className="block bg-muted text-foreground rounded-lg p-3 text-xs overflow-x-auto mb-3 font-mono"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            },
            pre: ({ children }) => <pre className="mb-3">{children}</pre>,
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-violet-600 dark:text-violet-400 underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            h3: ({ children }) => <h3 className="font-semibold text-base mt-4 mb-2">{children}</h3>,
            h4: ({ children }) => <h4 className="font-semibold text-sm mt-3 mb-1">{children}</h4>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-violet-300 dark:border-violet-700 pl-4 italic text-muted-foreground my-3">
                {children}
              </blockquote>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Actions: feedback + copy */}
      <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <FeedbackWidget onFeedback={onFeedback} existingFeedback={message.feedback} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Copy message"
        >
          <Copy className="w-3 h-3" />
        </Button>
        {copied && <span className="text-xs text-muted-foreground">Copied</span>}
      </div>
    </div>
  );
}

// ─── MessageList Component ──────────────────────────────────────────────────────

export function MessageList({
  messages,
  pendingConfirmation,
  onConfirm,
  onFeedback,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((msg) => {
        switch (msg.role) {
          case 'user':
            return <UserMessage key={msg.id} message={msg} />;
          case 'assistant':
            return (
              <AssistantMessage
                key={msg.id}
                message={msg}
                onFeedback={(rating, note) => onFeedback(msg.id, rating, note)}
              />
            );
          case 'tool_call':
            return <ToolCallMessage key={msg.id} message={msg} />;
          case 'tool_result':
            return <ToolResultMessage key={msg.id} message={msg} />;
          default:
            return null;
        }
      })}

      {/* Inline confirmation dialog */}
      {pendingConfirmation && (
        <ConfirmationDialog
          toolName={pendingConfirmation.toolName}
          toolArgs={pendingConfirmation.toolArgs}
          toolUseId={pendingConfirmation.toolUseId}
          onConfirm={onConfirm}
        />
      )}

      <div ref={endRef} />
    </div>
  );
}
