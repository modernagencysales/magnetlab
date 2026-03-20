'use client';

/**
 * MessageInput. Bottom input area for adding messages and requesting coaching.
 * Role toggle, textarea, add/paste/coaching buttons.
 * Never imports server-only modules.
 */

import { useState, useCallback } from 'react';
import { Button, Textarea } from '@magnetlab/magnetui';
import { Send, ClipboardPaste, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as dmCoachApi from '@/frontend/api/dm-coach';
import { useDmCoachStore } from '@/frontend/stores/dm-coach';
import type { MessageRole } from '@/lib/types/dm-coach';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────

interface MessageInputProps {
  contactId: string;
  onMutate: () => Promise<void>;
}

// ─── Component ─────────────────────────────────────────────────────

export function MessageInput({ contactId, onMutate }: MessageInputProps) {
  const [role, setRole] = useState<MessageRole>('them');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const { suggestionLoading, setSuggestionLoading, setIsPastingConversation } = useDmCoachStore();

  const handleAddMessage = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      await dmCoachApi.addMessages(contactId, [
        { role, content: trimmed, timestamp: new Date().toISOString() },
      ]);
      setContent('');
      await onMutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add message');
    } finally {
      setSending(false);
    }
  }, [contactId, content, role, onMutate]);

  const handleGetCoaching = useCallback(async () => {
    setSuggestionLoading(true);
    try {
      await dmCoachApi.getSuggestion(contactId);
      await onMutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get coaching suggestion');
    } finally {
      setSuggestionLoading(false);
    }
  }, [contactId, onMutate, setSuggestionLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAddMessage();
      }
    },
    [handleAddMessage]
  );

  return (
    <div className="border-t bg-background p-3">
      {/* Role toggle */}
      <div className="mb-2 flex items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">From:</span>
        <button
          type="button"
          onClick={() => setRole('them')}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            role === 'them'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Them
        </button>
        <button
          type="button"
          onClick={() => setRole('me')}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            role === 'me'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Me
        </button>
      </div>

      {/* Textarea */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={role === 'them' ? 'Paste their message...' : 'Type your message...'}
        rows={2}
        className="mb-2 resize-none text-sm"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleAddMessage} disabled={!content.trim() || sending}>
          {sending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 size-3.5" />
          )}
          Add
        </Button>

        <Button variant="outline" size="sm" onClick={() => setIsPastingConversation(true)}>
          <ClipboardPaste className="mr-1.5 size-3.5" />
          Paste Conversation
        </Button>

        <div className="flex-1" />

        <Button
          variant="secondary"
          size="sm"
          onClick={handleGetCoaching}
          disabled={suggestionLoading}
        >
          {suggestionLoading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 size-3.5" />
          )}
          Get Coaching
        </Button>
      </div>
    </div>
  );
}
