/**
 * MessageBubble. Renders a single message with role-based alignment and styling.
 * Presentational only — no state, no API calls.
 */

import { cn } from '@/lib/utils';
import type { DmcMessage } from '@/lib/types/dm-coach';

// ─── Types ─────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: DmcMessage;
}

// ─── Component ─────────────────────────────────────────────────────

export function MessageBubble({ message }: MessageBubbleProps) {
  const isMe = message.role === 'me';

  return (
    <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-3 py-2',
          isMe ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        <p
          className={cn(
            'mt-1 text-[10px]',
            isMe ? 'text-right text-primary/50' : 'text-muted-foreground/60'
          )}
        >
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) {
    const day = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${day} ${time}`;
  }
  return `${date.toLocaleDateString()} ${time}`;
}
