'use client';

/**
 * DmCoachEmptyState. Shown when no contact is selected or no contacts exist.
 * Never imports server-only modules.
 */

import { EmptyState, Button } from '@magnetlab/magnetui';
import { MessageSquare, Plus } from 'lucide-react';
import { useDmCoachStore } from '@/frontend/stores/dm-coach';

export function DmCoachEmptyState() {
  const { setIsAddingContact } = useDmCoachStore();

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<MessageSquare />}
        title="DM Coach"
        description="Add a contact and paste their DM conversation to get AI-coached replies."
        action={
          <Button size="sm" onClick={() => setIsAddingContact(true)}>
            <Plus className="mr-1.5 size-3.5" />
            Add Contact
          </Button>
        }
      />
    </div>
  );
}
