/**
 * Qualification Forms Repository (qualification_forms, qualification_questions)
 * ALL Supabase for forms and questions CRUD.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const FORM_COLUMNS = 'id, user_id, name, created_at, updated_at';
const QUESTION_COLUMNS =
  'id, funnel_page_id, form_id, question_text, question_order, answer_type, qualifying_answer, options, placeholder, is_qualifying, is_required, created_at';

export async function listForms(userId: string, limit: number, offset: number): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_forms')
    .select(FORM_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`qualification-forms.listForms: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function createForm(userId: string, name: string): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_forms')
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw new Error(`qualification-forms.createForm: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function getFormByIdAndUser(
  formId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_forms')
    .select(FORM_COLUMNS)
    .eq('id', formId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function assertFormOwnership(formId: string, userId: string): Promise<boolean> {
  const form = await getFormByIdAndUser(formId, userId);
  return !!form;
}

export async function updateForm(
  formId: string,
  userId: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_forms')
    .update(updates)
    .eq('id', formId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function deleteForm(formId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data: form } = await supabase
    .from('qualification_forms')
    .select('id')
    .eq('id', formId)
    .eq('user_id', userId)
    .single();
  if (!form) return false;
  const { error } = await supabase.from('qualification_forms').delete().eq('id', formId);
  if (error) throw new Error(`qualification-forms.deleteForm: ${error.message}`);
  return true;
}

export async function listQuestions(formId: string): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_questions')
    .select(QUESTION_COLUMNS)
    .eq('form_id', formId)
    .order('question_order', { ascending: true });
  if (error) throw new Error(`qualification-forms.listQuestions: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function getMaxQuestionOrder(formId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('qualification_questions')
    .select('question_order')
    .eq('form_id', formId)
    .order('question_order', { ascending: false })
    .limit(1)
    .single();
  const row = data as { question_order?: number } | null;
  return row?.question_order ?? -1;
}

export async function createQuestion(
  formId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_questions')
    .insert({ form_id: formId, funnel_page_id: null, ...payload })
    .select()
    .single();
  if (error) throw new Error(`qualification-forms.createQuestion: ${error.message}`);
  return data as Record<string, unknown>;
}

/** Bulk insert qualification questions (for external generate-quiz). */
export async function insertQuestionsBulk(
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('qualification_questions').insert(rows);
  if (error) throw new Error(`qualification-forms.insertQuestionsBulk: ${error.message}`);
}

export async function updateQuestion(
  questionId: string,
  formId: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_questions')
    .update(updates)
    .eq('id', questionId)
    .eq('form_id', formId)
    .select()
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function deleteQuestion(questionId: string, formId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('qualification_questions')
    .delete()
    .eq('id', questionId)
    .eq('form_id', formId);
  if (error) throw new Error(`qualification-forms.deleteQuestion: ${error.message}`);
}

export async function reorderQuestions(formId: string, questionIds: string[]): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const updates = questionIds.map((id, index) =>
    supabase.from('qualification_questions').update({ question_order: index }).eq('id', id).eq('form_id', formId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`qualification-forms.reorderQuestions: ${failed.error.message}`);
}
