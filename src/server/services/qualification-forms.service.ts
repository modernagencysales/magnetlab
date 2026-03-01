/**
 * Qualification Forms Service
 * Forms and questions CRUD; uses types from @/lib/types/funnel for mapping.
 */

import {
  qualificationFormFromRow,
  qualificationQuestionFromRow,
  type QualificationFormRow,
  type QualificationQuestionRow,
  type AnswerType,
} from '@/lib/types/funnel';
import * as repo from '@/server/repositories/qualification-forms.repo';

export const VALID_ANSWER_TYPES: AnswerType[] = ['yes_no', 'text', 'textarea', 'multiple_choice'];

export async function listForms(userId: string, limit: number, offset: number) {
  const data = await repo.listForms(userId, limit, offset);
  return { forms: (data as QualificationFormRow[]).map(qualificationFormFromRow) };
}

export async function createForm(userId: string, name: string) {
  const row = await repo.createForm(userId, name.trim());
  return { form: qualificationFormFromRow(row as QualificationFormRow) };
}

export async function getForm(userId: string, formId: string) {
  const row = await repo.getFormByIdAndUser(formId, userId);
  if (!row) return null;
  return { form: qualificationFormFromRow(row as QualificationFormRow) };
}

export async function updateForm(userId: string, formId: string, updates: { name?: string }) {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (Object.keys(payload).length === 0) return null;
  payload.updated_at = new Date().toISOString();
  const row = await repo.updateForm(formId, userId, payload);
  if (!row) return null;
  return { form: qualificationFormFromRow(row as QualificationFormRow) };
}

export async function deleteForm(userId: string, formId: string): Promise<boolean> {
  return repo.deleteForm(formId, userId);
}

export async function listQuestions(userId: string, formId: string) {
  const ok = await repo.assertFormOwnership(formId, userId);
  if (!ok) return null;
  const data = await repo.listQuestions(formId);
  return { questions: (data as QualificationQuestionRow[]).map(qualificationQuestionFromRow) };
}

export async function createQuestion(
  userId: string,
  formId: string,
  payload: {
    questionText: string;
    answerType?: AnswerType;
    questionOrder?: number;
    qualifyingAnswer?: string | string[] | null;
    options?: string[] | null;
    placeholder?: string | null;
    isQualifying?: boolean;
    isRequired?: boolean;
  },
) {
  const ok = await repo.assertFormOwnership(formId, userId);
  if (!ok) return null;
  const maxOrder = await repo.getMaxQuestionOrder(formId);
  const nextOrder = payload.questionOrder ?? maxOrder + 1;
  const row = await repo.createQuestion(formId, {
    question_text: payload.questionText,
    question_order: nextOrder,
    answer_type: payload.answerType ?? 'yes_no',
    qualifying_answer: payload.qualifyingAnswer ?? null,
    options: payload.answerType === 'multiple_choice' ? payload.options ?? null : null,
    placeholder: payload.placeholder ?? null,
    is_qualifying: payload.isQualifying ?? (payload.answerType === 'yes_no'),
    is_required: payload.isRequired ?? true,
  });
  return { question: qualificationQuestionFromRow(row as QualificationQuestionRow) };
}

export async function updateQuestion(
  userId: string,
  formId: string,
  questionId: string,
  updates: Record<string, unknown>,
) {
  const ok = await repo.assertFormOwnership(formId, userId);
  if (!ok) return null;
  const dbUpdates: Record<string, unknown> = {};
  if (updates.questionText !== undefined) dbUpdates.question_text = updates.questionText;
  if (updates.questionOrder !== undefined) dbUpdates.question_order = updates.questionOrder;
  if (updates.answerType !== undefined) dbUpdates.answer_type = updates.answerType;
  if (updates.qualifyingAnswer !== undefined) dbUpdates.qualifying_answer = updates.qualifyingAnswer;
  if (updates.options !== undefined) dbUpdates.options = updates.options;
  if (updates.placeholder !== undefined) dbUpdates.placeholder = updates.placeholder;
  if (updates.isQualifying !== undefined) dbUpdates.is_qualifying = updates.isQualifying;
  if (updates.isRequired !== undefined) dbUpdates.is_required = updates.isRequired;
  if (Object.keys(dbUpdates).length === 0) return null;
  const row = await repo.updateQuestion(questionId, formId, dbUpdates);
  if (!row) return null;
  return { question: qualificationQuestionFromRow(row as QualificationQuestionRow) };
}

export async function deleteQuestion(userId: string, formId: string, questionId: string): Promise<boolean | null> {
  const ok = await repo.assertFormOwnership(formId, userId);
  if (!ok) return null;
  await repo.deleteQuestion(questionId, formId);
  return true;
}

export async function reorderQuestions(userId: string, formId: string, questionIds: string[]): Promise<boolean | null> {
  const ok = await repo.assertFormOwnership(formId, userId);
  if (!ok) return null;
  await repo.reorderQuestions(formId, questionIds);
  return true;
}
