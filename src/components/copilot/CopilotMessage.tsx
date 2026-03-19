'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Wrench } from 'lucide-react';
import { FeedbackWidget } from './FeedbackWidget';
import type { CopilotMessage as CopilotMessageType } from './copilot-types';
import { PostPreviewCard } from './PostPreviewCard';
import { KnowledgeResultCard } from './KnowledgeResultCard';
import { IdeaListCard } from './IdeaListCard';

interface CopilotMessageProps {
  message: CopilotMessageType;
  onFeedback: (rating: 'positive' | 'negative', note?: string) => void;
  onApply?: (type: string, data: unknown) => void;
}

export function CopilotMessage({ message, onFeedback, onApply }: CopilotMessageProps) {
  if (message.role === 'tool_call') {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground py-1">
        <Wrench className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Using <strong className="text-muted-foreground">{message.toolName}</strong>...
        </span>
      </div>
    );
  }

  if (message.role === 'tool_result') {
    const result = message.toolResult;
    const resultData = (
      result && typeof result === 'object' && 'data' in result ? result.data : result
    ) as Record<string, unknown> | unknown[] | undefined;

    // Route to rich cards based on displayHint
    switch (message.displayHint) {
      case 'post_preview':
        return (
          <div className="my-1">
            <PostPreviewCard
              data={resultData as Parameters<typeof PostPreviewCard>[0]['data']}
              onApply={onApply}
            />
          </div>
        );
      case 'knowledge_list':
        return (
          <div className="my-1">
            <KnowledgeResultCard
              data={resultData as Parameters<typeof KnowledgeResultCard>[0]['data']}
              onApply={onApply}
            />
          </div>
        );
      case 'idea_list':
        return (
          <div className="my-1">
            <IdeaListCard
              data={resultData as Parameters<typeof IdeaListCard>[0]['data']}
              onApply={onApply}
            />
          </div>
        );
      default:
        break;
    }

    // Default: simple success/failure badge
    const success = result && typeof result === 'object' && 'success' in result && result.success;
    return (
      <div
        className={`rounded px-2 py-1 text-xs ${success ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-destructive/10 text-destructive'}`}
      >
        {success ? 'Done' : 'Failed'}: {message.toolName}
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? 'bg-violet-600 text-white whitespace-pre-wrap' : 'bg-muted text-foreground'
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
              li: ({ children }) => <li className="mb-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              code: ({ node, className, children, ...props }) => {
                const isBlock =
                  className?.includes('language-') ||
                  (node?.position && node.position.start.line !== node.position.end.line);
                if (isBlock) {
                  return (
                    <code
                      className="block bg-muted text-foreground rounded p-2 text-xs overflow-x-auto mb-2"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => <pre className="mb-2">{children}</pre>,
              a: ({ children, href }) => (
                <a
                  href={href}
                  className="text-violet-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              h3: ({ children }) => <h3 className="font-semibold text-sm mt-2 mb-1">{children}</h3>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      {/* Feedback buttons for assistant messages */}
      {message.role === 'assistant' && message.content && (
        <FeedbackWidget onFeedback={onFeedback} existingFeedback={message.feedback} />
      )}
    </div>
  );
}
