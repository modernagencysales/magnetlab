'use client';

/**
 * ContactDetail. Right panel showing contact header, conversation thread,
 * coaching suggestion, and message input.
 * Never imports server-only modules.
 */

import { Spinner } from '@magnetlab/magnetui';
import type { DmcContact, DmcMessage, DmcSuggestion } from '@/lib/types/dm-coach';
import { ContactHeader } from './ContactHeader';
import { ConversationThread } from './ConversationThread';
import { SuggestionCard } from './SuggestionCard';
import { MessageInput } from './MessageInput';

// ─── Types ─────────────────────────────────────────────────────────

interface ContactDetailProps {
  contact: DmcContact;
  messages: DmcMessage[];
  latestSuggestion: DmcSuggestion | null;
  isLoading: boolean;
  onMutate: () => Promise<void>;
}

// ─── Component ─────────────────────────────────────────────────────

export function ContactDetail({
  contact,
  messages,
  latestSuggestion,
  isLoading,
  onMutate,
}: ContactDetailProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ContactHeader contact={contact} onMutate={onMutate} />

      <div className="flex-1 overflow-y-auto">
        <ConversationThread messages={messages} />

        {latestSuggestion && (
          <div className="px-4 pb-3">
            <SuggestionCard
              suggestion={latestSuggestion}
              contactId={contact.id}
              onMutate={onMutate}
            />
          </div>
        )}
      </div>

      <MessageInput contactId={contact.id} onMutate={onMutate} />
    </div>
  );
}
