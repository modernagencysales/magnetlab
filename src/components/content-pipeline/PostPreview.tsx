'use client';

import { LinkedInPreview } from './LinkedInPreview';

interface PostPreviewProps {
  content: string;
  authorName?: string;
  authorHeadline?: string;
  authorAvatarUrl?: string | null;
}

export function PostPreview({
  content,
  authorName = 'You',
  authorHeadline = '',
  authorAvatarUrl = null,
}: PostPreviewProps) {
  return (
    <LinkedInPreview
      content={content}
      authorName={authorName}
      authorHeadline={authorHeadline}
      authorAvatarUrl={authorAvatarUrl}
    />
  );
}
