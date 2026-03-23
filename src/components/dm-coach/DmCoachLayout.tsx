'use client';

/**
 * DmCoachLayout. Two-panel master/detail layout for DM Coach.
 * Left: ContactList (280px). Right: ContactDetail or EmptyState.
 * Never imports server-only modules.
 */

import { MasterDetail, MasterPane, DetailPane, PageContainer } from '@magnetlab/magnetui';
import { useDmCoachContacts, useDmCoachContact } from '@/frontend/hooks/api/useDmCoach';
import { useDmCoachStore } from '@/frontend/stores/dm-coach';
import { ContactList } from './ContactList';
import { ContactDetail } from './ContactDetail';
import { ContactFormModal } from './ContactFormModal';
import { PasteConversationModal } from './PasteConversationModal';
import { DmCoachEmptyState } from './EmptyState';

export function DmCoachLayout() {
  const { activeContactId, isAddingContact, isPastingConversation } = useDmCoachStore();

  const contactsResult = useDmCoachContacts();
  const contactResult = useDmCoachContact(activeContactId);

  return (
    <PageContainer maxWidth="full" className="h-[calc(100vh-3.5rem)]">
      <MasterDetail className="h-full rounded-lg border bg-background">
        <MasterPane width={300} className="border-r">
          <ContactList
            contacts={contactsResult.contacts}
            isLoading={contactsResult.isLoading}
            onMutate={contactsResult.mutate}
          />
        </MasterPane>
        <DetailPane>
          {activeContactId && contactResult.contact ? (
            <ContactDetail
              contact={contactResult.contact}
              messages={contactResult.messages}
              latestSuggestion={contactResult.latestSuggestion}
              isLoading={contactResult.isLoading}
              onMutate={async () => {
                await contactResult.mutate();
                await contactsResult.mutate();
              }}
            />
          ) : (
            <DmCoachEmptyState />
          )}
        </DetailPane>
      </MasterDetail>

      <ContactFormModal
        open={isAddingContact}
        onOpenChange={(open) => useDmCoachStore.getState().setIsAddingContact(open)}
        onSaved={async (contact) => {
          await contactsResult.mutate();
          useDmCoachStore.getState().setActiveContactId(contact.id);
        }}
      />

      {activeContactId && (
        <PasteConversationModal
          open={isPastingConversation}
          onOpenChange={(open) => useDmCoachStore.getState().setIsPastingConversation(open)}
          contactId={activeContactId}
          onSaved={contactResult.mutate}
        />
      )}
    </PageContainer>
  );
}
