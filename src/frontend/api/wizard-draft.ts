/**
 * Wizard draft API (client). GET list, PUT save, DELETE.
 */

import { apiClient } from './client';
import type { WizardState } from '@/lib/types/lead-magnet';

export interface DraftSummary {
  id: string;
  updated_at: string;
  wizard_state: WizardState;
}

export async function listDrafts(): Promise<{ drafts: DraftSummary[] }> {
  return apiClient.get<{ drafts: DraftSummary[] }>('/wizard-draft');
}

export async function saveDraft(payload: {
  id?: string;
  wizardState: WizardState;
}): Promise<{ id: string; wizardState: WizardState }> {
  return apiClient.put<{ id: string; wizardState: WizardState }>('/wizard-draft', payload);
}

export async function deleteDraft(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>('/wizard-draft', { body: { id } });
}