/**
 * DM Coach client state (Zustand).
 * Used for active contact selection and UI state across DM Coach components.
 */

import { create } from 'zustand';

interface DmCoachState {
  activeContactId: string | null;
  setActiveContactId: (id: string | null) => void;
  isAddingContact: boolean;
  setIsAddingContact: (v: boolean) => void;
  isPastingConversation: boolean;
  setIsPastingConversation: (v: boolean) => void;
  suggestionLoading: boolean;
  setSuggestionLoading: (v: boolean) => void;
}

export const useDmCoachStore = create<DmCoachState>((set) => ({
  activeContactId: null,
  setActiveContactId: (id) => set({ activeContactId: id }),
  isAddingContact: false,
  setIsAddingContact: (v) => set({ isAddingContact: v }),
  isPastingConversation: false,
  setIsPastingConversation: (v) => set({ isPastingConversation: v }),
  suggestionLoading: false,
  setSuggestionLoading: (v) => set({ suggestionLoading: v }),
}));
