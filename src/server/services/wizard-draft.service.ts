/**
 * Wizard Draft Service
 * List, create, update, delete extraction_sessions drafts.
 */

import type { WizardState } from '@/lib/types/lead-magnet';
import * as wizardDraftRepo from '@/server/repositories/wizard-draft.repo';
import type { DataScope } from '@/lib/utils/team-context';

export function deriveDraftTitle(wizardState: WizardState): string {
  if (wizardState.isCustomIdea && wizardState.customConcept?.title) {
    return wizardState.customConcept.title;
  }
  if (
    wizardState.ideationResult &&
    wizardState.selectedConceptIndex !== null &&
    wizardState.ideationResult.concepts[wizardState.selectedConceptIndex]?.title
  ) {
    return wizardState.ideationResult.concepts[wizardState.selectedConceptIndex].title;
  }
  return 'Untitled Draft';
}

export async function listDrafts(scope: DataScope) {
  const drafts = await wizardDraftRepo.listDrafts(scope);
  return { drafts };
}

export async function saveDraft(
  userId: string,
  scope: DataScope,
  id: string | undefined,
  wizardState: WizardState,
): Promise<{ id: string }> {
  const draftTitle = deriveDraftTitle(wizardState);
  const payload = {
    wizard_state: wizardState,
    current_step: wizardState.currentStep,
    draft_title: draftTitle,
    extraction_answers: wizardState.extractionAnswers ?? {},
    selected_concept_index: wizardState.selectedConceptIndex,
  };

  if (id) {
    await wizardDraftRepo.updateDraft(id, userId, payload);
    return { id };
  }
  const row = await wizardDraftRepo.createDraft(userId, scope.teamId ?? null, payload);
  return { id: row.id };
}

export async function deleteDraft(userId: string, draftId: string): Promise<void> {
  await wizardDraftRepo.deleteDraft(draftId, userId);
}
