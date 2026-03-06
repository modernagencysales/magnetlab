/**
 * Qualification Forms API (client). Routes: /api/qualification-forms/[formId]/questions
 */

import { apiClient } from './client';
import type { QualificationQuestion } from '@/lib/types/funnel';

export interface CreateQuestionBody {
  questionText: string;
  answerType: string;
  qualifyingAnswer?: string | string[] | null;
  options?: string[] | null;
  placeholder?: string | null;
  isQualifying: boolean;
  isRequired: boolean;
  questionOrder?: number;
}

export async function createFormQuestion(
  formId: string,
  body: CreateQuestionBody
): Promise<{ question: QualificationQuestion }> {
  return apiClient.post<{ question: QualificationQuestion }>(
    `/qualification-forms/${formId}/questions`,
    body
  );
}

export async function updateFormQuestion(
  formId: string,
  questionId: string,
  updates: Record<string, unknown>
): Promise<{ question: QualificationQuestion }> {
  return apiClient.put<{ question: QualificationQuestion }>(
    `/qualification-forms/${formId}/questions/${questionId}`,
    updates
  );
}

export async function deleteFormQuestion(formId: string, questionId: string): Promise<void> {
  await apiClient.delete(`/qualification-forms/${formId}/questions/${questionId}`);
}

export async function reorderFormQuestions(formId: string, questionIds: string[]): Promise<void> {
  await apiClient.patch(`/qualification-forms/${formId}/questions`, { questionIds });
}
