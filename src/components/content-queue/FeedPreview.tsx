'use client';

/**
 * FeedPreview.
 * LinkedIn feed-style preview showing hook text with truncation.
 * Wraps the existing LinkedInPreview component with hookOnly mode.
 * Never fetches data; receives everything via props.
 */

import { LinkedInPreview } from '@/components/content-pipeline/LinkedInPreview';

// ─── Types ─────────────────────────────────────────────────────────────────

interface FeedPreviewProps {
  content: string;
  authorName: string;
  authorHeadline: string;
  imageUrl: string | null;
  onClick?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function FeedPreview({
  content,
  authorName,
  authorHeadline,
  imageUrl,
  onClick,
}: FeedPreviewProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
      className="cursor-pointer transition-opacity hover:opacity-90"
    >
      <LinkedInPreview
        content={content}
        authorName={authorName}
        authorHeadline={authorHeadline}
        authorAvatarUrl={null}
        hookOnly
        imageUrl={imageUrl}
      />
    </div>
  );
}
