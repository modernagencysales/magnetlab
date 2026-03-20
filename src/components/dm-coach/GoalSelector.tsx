'use client';

/**
 * GoalSelector. Dropdown to pick conversation goal for a contact.
 * Updates the contact's goal via the API on change.
 * Never imports server-only modules.
 */

import { useCallback, useState } from 'react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@magnetlab/magnetui';
import { toast } from 'sonner';
import * as dmCoachApi from '@/frontend/api/dm-coach';
import type { DmcContact, ConversationGoal } from '@/lib/types/dm-coach';
import { CONVERSATION_GOALS } from '@/lib/types/dm-coach';

// ─── Types ─────────────────────────────────────────────────────────

interface GoalSelectorProps {
  contact: DmcContact;
  onMutate: () => Promise<void>;
}

// ─── Constants ─────────────────────────────────────────────────────

const GOAL_KEYS = Object.keys(CONVERSATION_GOALS) as ConversationGoal[];

// ─── Component ─────────────────────────────────────────────────────

export function GoalSelector({ contact, onMutate }: GoalSelectorProps) {
  const [updating, setUpdating] = useState(false);

  const handleChange = useCallback(
    async (value: string) => {
      if (value === contact.conversation_goal) return;

      setUpdating(true);
      try {
        await dmCoachApi.updateContact(contact.id, {
          conversation_goal: value as ConversationGoal,
        });
        await onMutate();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update goal');
      } finally {
        setUpdating(false);
      }
    },
    [contact.id, contact.conversation_goal, onMutate]
  );

  return (
    <Select value={contact.conversation_goal} onValueChange={handleChange} disabled={updating}>
      <SelectTrigger className="h-7 w-[160px] text-xs">
        <SelectValue placeholder="Select goal" />
      </SelectTrigger>
      <SelectContent>
        {GOAL_KEYS.map((key) => (
          <SelectItem key={key} value={key} className="text-xs">
            {CONVERSATION_GOALS[key].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
