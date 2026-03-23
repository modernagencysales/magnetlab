'use client';

/**
 * ConversationThread. Scrollable message list that auto-scrolls on new messages.
 * Never imports server-only modules.
 */

import { useRef, useEffect } from 'react';
import { EmptyState } from '@magnetlab/magnetui';
import { MessageSquare } from 'lucide-react';
import type { DmcMessage } from '@/lib/types/dm-coach';
import { MessageBubble } from './MessageBubble';

// ─── Types ─────────────────────────────────────────────────────────

interface ConversationThreadProps {
  messages: DmcMessage[];
}

// ─── Component ─────────────────────────────────────────────────────

export function ConversationThread({ messages }: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on first load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare />}
        title="No messages yet"
        description="Paste or add messages to start coaching"
        className="py-16"
      />
    );
  }

  return (
    <div className="space-y-2 px-4 py-3">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
