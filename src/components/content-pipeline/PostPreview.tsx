'use client';

import { ThumbsUp, MessageCircle, Repeat, Send } from 'lucide-react';

interface PostPreviewProps {
  content: string;
}

export function PostPreview({ content }: PostPreviewProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          You
        </div>
        <div>
          <p className="text-sm font-medium">You</p>
          <p className="text-xs text-muted-foreground">Just now</p>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4 whitespace-pre-line text-sm leading-relaxed">
        {content}
      </div>

      {/* Reaction Bar */}
      <div className="flex items-center gap-6 border-t pt-3 text-muted-foreground">
        <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
          <ThumbsUp className="h-4 w-4" /> Like
        </button>
        <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
          <MessageCircle className="h-4 w-4" /> Comment
        </button>
        <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
          <Repeat className="h-4 w-4" /> Repost
        </button>
        <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
          <Send className="h-4 w-4" /> Send
        </button>
      </div>
    </div>
  );
}
