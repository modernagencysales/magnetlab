'use client';

import React, { useMemo } from 'react';
import { ThumbsUp, MessageCircle, Repeat2, Send, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeviceMode = 'desktop' | 'mobile' | 'tablet';

interface LinkedInPreviewProps {
  content: string;
  authorName: string;
  authorHeadline: string;
  authorAvatarUrl: string | null;
  device?: DeviceMode;
  hookOnly?: boolean;
  imageUrl?: string | null;
}

const DEVICE_WIDTHS: Record<DeviceMode, number> = {
  desktop: 540,
  tablet: 440,
  mobile: 340,
};

const TRUNCATION_LINES: Record<DeviceMode, number> = {
  desktop: 5,
  tablet: 4,
  mobile: 3,
};

const LINKEDIN_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Parse inline markdown (**bold** and *italic*) into React elements.
 * Handles both bold (**text**) and italic (*text*) markers.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Match **bold** and *italic* patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} style={{ fontStyle: 'italic' }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

/**
 * Determine if the content exceeds the truncation threshold for the given device.
 * Uses a line-count heuristic: each '\n' is a visual line.
 */
function shouldTruncate(content: string, device: DeviceMode): boolean {
  const lines = content.split('\n');
  const maxLines = TRUNCATION_LINES[device];
  return lines.length > maxLines;
}

/**
 * Get truncated content and the remaining "below the fold" content.
 */
function getTruncatedContent(
  content: string,
  device: DeviceMode
): { visible: string; remaining: string } {
  const lines = content.split('\n');
  const maxLines = TRUNCATION_LINES[device];
  const visible = lines.slice(0, maxLines).join('\n');
  const remaining = lines.slice(maxLines).join('\n');
  return { visible, remaining };
}

export function LinkedInPreview({
  content,
  authorName,
  authorHeadline,
  authorAvatarUrl,
  device = 'desktop',
  hookOnly = false,
  imageUrl,
}: LinkedInPreviewProps) {
  const width = DEVICE_WIDTHS[device];
  const truncate = useMemo(() => shouldTruncate(content, device), [content, device]);
  const { visible, remaining } = useMemo(
    () => getTruncatedContent(content, device),
    [content, device]
  );
  const initials = useMemo(() => getInitials(authorName), [authorName]);

  return (
    <div
      data-device={device}
      className="rounded-lg overflow-hidden"
      style={{
        width,
        maxWidth: '100%',
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        fontFamily: LINKEDIN_FONT_STACK,
      }}
    >
      {/* Author header */}
      <div className="flex items-start gap-2 p-3 pb-0">
        {/* Avatar */}
        {authorAvatarUrl ? (
          <img
            src={authorAvatarUrl}
            alt={authorName}
            className="rounded-full object-cover flex-shrink-0"
            style={{ width: 48, height: 48 }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#0a66c2',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
        )}

        {/* Name + Headline + Timestamp */}
        <div className="flex flex-col min-w-0">
          <span
            className="font-semibold leading-tight"
            style={{ color: '#000000e6', fontSize: 14 }}
          >
            {authorName}
          </span>
          <span
            className="leading-tight truncate"
            style={{ color: '#00000099', fontSize: 12 }}
          >
            {authorHeadline}
          </span>
          <span
            className="flex items-center gap-1"
            style={{ color: '#00000099', fontSize: 12 }}
          >
            Just now &middot; <Globe className="inline" style={{ width: 12, height: 12 }} />
          </span>
        </div>
      </div>

      {/* Post content */}
      <div className="px-3 pt-2 pb-1">
        {truncate ? (
          <>
            {/* Visible (above the fold) portion */}
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.43,
                color: '#000000e6',
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
              }}
            >
              {parseInlineMarkdown(visible)}
              <span
                style={{
                  color: '#00000099',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ...more
              </span>
            </div>

            {/* Hook-only mode: show remaining content dimmed */}
            {hookOnly && remaining && (
              <div
                className="mt-1"
                style={{
                  opacity: 0.3,
                  borderTop: '1px dashed #00000033',
                  paddingTop: 8,
                  fontSize: 14,
                  lineHeight: 1.43,
                  color: '#000000e6',
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                }}
              >
                {parseInlineMarkdown(remaining)}
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.43,
              color: '#000000e6',
              whiteSpace: 'pre-line',
              wordBreak: 'break-word',
            }}
          >
            {parseInlineMarkdown(content)}
          </div>
        )}
      </div>

      {/* Optional image */}
      {imageUrl && (
        <div className="mt-1">
          <img
            src={imageUrl}
            alt="Post image"
            className="w-full object-cover"
            style={{ maxHeight: 400 }}
          />
        </div>
      )}

      {/* Engagement counts */}
      <div
        className="flex items-center gap-1 px-3 py-1"
        style={{ fontSize: 12, color: '#00000099' }}
      >
        <span>&#128077; 0</span>
        <span className="ml-auto">0 comments</span>
      </div>

      {/* Divider */}
      <div className="mx-3" style={{ borderTop: '1px solid #e0e0e0' }} />

      {/* Action bar */}
      <div className="flex items-center justify-between px-2 py-1">
        <ActionButton icon={<ThumbsUp style={{ width: 18, height: 18 }} />} label="Like" />
        <ActionButton icon={<MessageCircle style={{ width: 18, height: 18 }} />} label="Comment" />
        <ActionButton icon={<Repeat2 style={{ width: 18, height: 18 }} />} label="Repost" />
        <ActionButton icon={<Send style={{ width: 18, height: 18 }} />} label="Send" />
      </div>
    </div>
  );
}

function ActionButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 px-3 py-2 rounded hover:bg-muted transition-colors',
        'text-xs font-semibold'
      )}
      style={{ color: '#00000099' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
