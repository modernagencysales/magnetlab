'use client';

/**
 * PostEditor.
 * Center column of the editing view — LinkedIn-style editor with feed preview toggle.
 * Two modes: edit mode (TipTap editor) and feed preview mode (FeedPreview).
 * Never fetches data; receives everything via props.
 */

import { Eye, EyeOff, Globe } from 'lucide-react';
import { TipTapTextBlock } from '@/components/content/inline-editor/TipTapTextBlock';
import { FeedPreview } from './FeedPreview';
import { ImageDropZone } from './ImageDropZone';
import type { QueuePost } from '@/frontend/api/content-queue';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PostEditorProps {
  post: QueuePost;
  authorName: string;
  authorHeadline: string;
  isPreviewMode: boolean;
  onTogglePreview: () => void;
  onContentChange: (content: string) => void;
  imageUrl: string | null;
  onImageUploaded: (imageUrl: string, storagePath: string) => void;
  onImageRemoved: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Component ─────────────────────────────────────────────────────────────

export function PostEditor({
  post,
  authorName,
  authorHeadline,
  isPreviewMode,
  onTogglePreview,
  onContentChange,
  imageUrl,
  onImageUploaded,
  onImageRemoved,
}: PostEditorProps) {
  const initials = getInitials(authorName || 'U');

  // Feed preview mode
  if (isPreviewMode) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 self-end">
          <button
            type="button"
            onClick={onTogglePreview}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Exit Preview
          </button>
        </div>
        <FeedPreview
          content={post.draft_content ?? ''}
          authorName={authorName}
          authorHeadline={authorHeadline}
          imageUrl={imageUrl}
          onClick={onTogglePreview}
        />
      </div>
    );
  }

  // Edit mode
  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {post.idea_content_type && (
            <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {post.idea_content_type}
            </span>
          )}
          {post.idea_title && (
            <span className="truncate text-xs text-muted-foreground">{post.idea_title}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onTogglePreview}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>

      {/* LinkedIn chrome */}
      <div className="rounded-lg border border-border bg-card">
        {/* Author header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{authorName}</span>
            <span className="text-xs text-muted-foreground">{authorHeadline}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Just now &middot; <Globe className="inline h-3 w-3" />
            </span>
          </div>
        </div>

        {/* TipTap editor area */}
        <div className="px-4 py-2">
          <TipTapTextBlock
            content={post.draft_content ?? ''}
            onChange={onContentChange}
            placeholder="Write your post content..."
            className="min-h-[200px] text-sm text-foreground [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground"
          />
        </div>

        {/* Image drop zone */}
        <div className="border-t border-border px-4 py-2">
          <ImageDropZone
            postId={post.id}
            existingImageUrl={imageUrl}
            onImageUploaded={onImageUploaded}
            onImageRemoved={onImageRemoved}
          />
        </div>

        {/* Engagement bar */}
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>Like</span>
            <span>Comment</span>
            <span>Repost</span>
            <span>Send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
