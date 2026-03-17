'use client';

import React, { useState } from 'react';
import { FileText, Copy, ArrowRight } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';

interface Props {
  data: {
    content?: string;
    post?: { id: string; draft_content?: string; status?: string };
    variations?: Array<{ content: string }>;
  };
  onApply?: (type: string, data: unknown) => void;
}

export function PostPreviewCard({ data, onApply }: Props) {
  const [copied, setCopied] = useState(false);

  const content = data.content || data.post?.draft_content || '';
  const postId = data.post?.id;
  const variationCount = data.variations?.length || 0;
  const isLong = content.length > 300;
  const preview = isLong ? content.slice(0, 300) + '...' : content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may not be available
    }
  };

  const handleApply = () => {
    onApply?.('post_content', { content, postId });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Post Preview</span>
        {variationCount > 0 && (
          <span className="ml-auto text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
            +{variationCount} variations
          </span>
        )}
      </div>

      <div className="text-sm text-foreground whitespace-pre-wrap mb-3">{preview}</div>

      <div className="flex items-center gap-2">
        {onApply && (
          <Button size="sm" onClick={handleApply}>
            <ArrowRight className="w-3 h-3 mr-1" />
            Apply to editor
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="w-3 h-3 mr-1" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
