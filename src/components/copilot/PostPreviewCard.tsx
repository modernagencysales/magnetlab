'use client';

import React, { useState } from 'react';
import { FileText, Copy, ArrowRight } from 'lucide-react';

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
    <div className="rounded-lg border border-gray-200 bg-white p-3 my-2">
      <div className="flex items-center gap-1.5 mb-2">
        <FileText className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-500">Post Preview</span>
        {variationCount > 0 && (
          <span className="ml-auto text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
            +{variationCount} variations
          </span>
        )}
      </div>

      <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">
        {preview}
      </div>

      <div className="flex items-center gap-2">
        {onApply && (
          <button
            onClick={handleApply}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 transition-colors"
          >
            <ArrowRight className="w-3 h-3" />
            Apply to editor
          </button>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          <Copy className="w-3 h-3" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
