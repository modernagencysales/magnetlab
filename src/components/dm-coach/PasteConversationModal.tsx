'use client';

/**
 * PasteConversationModal. Bulk paste DM conversation with preview and role correction.
 * Parses pasted text into messages, shows preview, lets user flip roles, then submits.
 * Never imports server-only modules.
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Textarea,
  ScrollArea,
} from '@magnetlab/magnetui';
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import * as dmCoachApi from '@/frontend/api/dm-coach';
import type { MessageRole } from '@/lib/types/dm-coach';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────

interface PasteConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  onSaved: () => Promise<void>;
}

interface ParsedMessage {
  role: MessageRole;
  content: string;
  senderHint: string | null;
}

// ─── Component ─────────────────────────────────────────────────────

export function PasteConversationModal({
  open,
  onOpenChange,
  contactId,
  onSaved,
}: PasteConversationModalProps) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedMessage[] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleParse = useCallback(() => {
    const messages = parseConversation(rawText);
    if (messages.length === 0) {
      toast.error('Could not parse any messages. Try separating messages with blank lines.');
      return;
    }
    setParsed(messages);
  }, [rawText]);

  const toggleRole = useCallback((index: number) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        role: updated[index].role === 'them' ? 'me' : 'them',
      };
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!parsed || parsed.length === 0) return;

    setSaving(true);
    try {
      const messages = parsed.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      await dmCoachApi.addMessages(contactId, messages);
      await onSaved();
      toast.success(`${messages.length} messages added`);
      // Reset and close
      setRawText('');
      setParsed(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add messages');
    } finally {
      setSaving(false);
    }
  }, [parsed, contactId, onSaved, onOpenChange]);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setRawText('');
        setParsed(null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Paste Conversation</DialogTitle>
          <DialogDescription>
            Paste your DM conversation below. Each message should be separated by a blank line, or
            start with a name followed by a colon (e.g., &quot;John: Hello&quot;).
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          // Step 1: Paste raw text
          <div className="space-y-3 py-2">
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={PASTE_PLACEHOLDER}
              rows={12}
              className="resize-none font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Messages are assigned alternating roles (them/me). You can correct roles in the next
              step.
            </p>
          </div>
        ) : (
          // Step 2: Preview and correct roles
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {parsed.length} messages parsed. Click the role button to flip between
              &quot;Them&quot; and &quot;Me&quot;.
            </p>
            <ScrollArea className="h-[360px] rounded-md border">
              <div className="space-y-1 p-2">
                {parsed.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md p-2 hover:bg-muted/50">
                    <button
                      type="button"
                      onClick={() => toggleRole(i)}
                      className={cn(
                        'mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors',
                        msg.role === 'them'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {msg.role === 'them' ? 'Them' : 'Me'}
                    </button>
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {!parsed ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleParse} disabled={!rawText.trim()}>
                Parse
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setParsed(null)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Add {parsed.length} Messages
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Parser ────────────────────────────────────────────────────────

const PASTE_PLACEHOLDER = `John Smith: Hey, saw your post about lead gen. Really resonated with me.

Me: Thanks John! What specifically caught your eye?

John Smith: We've been struggling with outbound for months. Nothing seems to work.`;

/**
 * Parses pasted text into messages. Supports:
 * - "Name: message" format
 * - "[Name]: message" format
 * - Double-newline separated paragraphs (assigned alternating roles)
 */
function parseConversation(raw: string): ParsedMessage[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const messages: ParsedMessage[] = [];

  // Try name:message pattern first
  const namedPattern = /^(?:\[?([A-Za-z][\w\s.'-]{0,40})\]?\s*:\s*)(.*)/;
  const lines = trimmed.split('\n');
  const blocks: { sender: string | null; text: string }[] = [];

  let currentBlock: { sender: string | null; text: string } | null = null;

  for (const line of lines) {
    const match = line.match(namedPattern);
    if (match) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { sender: match[1].trim(), text: match[2].trim() };
    } else if (line.trim() === '') {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    } else {
      if (currentBlock) {
        currentBlock.text += '\n' + line;
      } else {
        currentBlock = { sender: null, text: line };
      }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  // If we detected named senders, use those to assign roles
  const senders = new Set(blocks.filter((b) => b.sender).map((b) => b.sender!.toLowerCase()));

  if (senders.size >= 2) {
    // Most common sender assumed to be "them", second is "me"
    const senderCounts: Record<string, number> = {};
    for (const block of blocks) {
      if (block.sender) {
        const key = block.sender.toLowerCase();
        senderCounts[key] = (senderCounts[key] || 0) + 1;
      }
    }
    // "Me" matches common self-references
    const mePatterns = ['me', 'i', 'myself'];
    let meSender: string | null = null;

    for (const s of senders) {
      if (mePatterns.includes(s)) {
        meSender = s;
        break;
      }
    }

    // If no explicit "me", assign first speaker as "them"
    const firstSender = blocks.find((b) => b.sender)?.sender?.toLowerCase() ?? null;
    if (!meSender && firstSender) {
      meSender = [...senders].find((s) => s !== firstSender) ?? null;
    }

    for (const block of blocks) {
      if (!block.text.trim()) continue;
      const isMe = block.sender?.toLowerCase() === meSender;
      messages.push({
        role: isMe ? 'me' : 'them',
        content: block.text.trim(),
        senderHint: block.sender,
      });
    }
  } else {
    // Fallback: alternate roles starting with "them"
    for (const block of blocks) {
      if (!block.text.trim()) continue;
      messages.push({
        role: messages.length % 2 === 0 ? 'them' : 'me',
        content: block.text.trim(),
        senderHint: block.sender,
      });
    }
  }

  return messages;
}
