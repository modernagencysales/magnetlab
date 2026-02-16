'use client';

import { MessageSquare, Send } from 'lucide-react';
import type { GPTConfig } from '@/lib/types/lead-magnet';

interface GPTPreviewProps {
  config: GPTConfig;
}

export function GPTPreview({ config }: GPTPreviewProps) {
  const truncatedPrompt =
    config.systemPrompt.length > 100
      ? config.systemPrompt.substring(0, 100) + '...'
      : config.systemPrompt;

  return (
    <div className="space-y-6">
      {/* Chat header */}
      <div className="flex items-center gap-3 rounded-lg border bg-background p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold">{config.name}</h2>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="rounded-lg border bg-background">
        {/* Messages */}
        <div className="space-y-4 p-4">
          {/* Welcome message as AI bubble */}
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg rounded-tl-none bg-muted px-4 py-3">
              <p className="text-sm">{config.welcomeMessage}</p>
            </div>
          </div>
        </div>

        {/* Suggested prompts */}
        {config.suggestedPrompts.length > 0 && (
          <div className="border-t px-4 py-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Try asking:</div>
            <div className="flex flex-wrap gap-2">
              {config.suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled
                  className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Disabled input */}
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              disabled
              placeholder="Ask me anything..."
              className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
            />
            <button
              type="button"
              disabled
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/50 text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* System prompt note */}
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs font-medium text-muted-foreground">System prompt:</div>
        <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{truncatedPrompt}&rdquo;</p>
      </div>
    </div>
  );
}
