/**
 * Content pipeline client state (Zustand).
 * Used for shared profile/team selection and any cross-component state.
 */

import { create } from 'zustand';

interface ContentPipelineState {
  selectedProfileId: string | null;
  selectedTeamId: string | null;
  setSelectedProfileId: (id: string | null) => void;
  setSelectedTeamId: (id: string | null) => void;
}

export const useContentPipelineStore = create<ContentPipelineState>((set) => ({
  selectedProfileId: null,
  selectedTeamId: null,
  setSelectedProfileId: (id) => set({ selectedProfileId: id }),
  setSelectedTeamId: (id) => set({ selectedTeamId: id }),
}));
