/**
 * Shared helper for resolving qualification questions.
 * Supports both form-based (shared) and legacy funnel-based questions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  qualificationQuestionFromRow,
  type QualificationQuestion,
  type QualificationQuestionRow,
} from '@/lib/types/funnel';

/**
 * Resolve qualification questions for a funnel page.
 * If qualificationFormId is set, queries by form_id (shared form).
 * Otherwise falls back to querying by funnel_page_id (legacy).
 */
export async function resolveQuestionsForFunnel(
  supabase: SupabaseClient,
  funnelPageId: string,
  qualificationFormId: string | null
): Promise<{ questions: QualificationQuestion[]; error: string | null }> {
  let query;

  if (qualificationFormId) {
    query = supabase
      .from('qualification_questions')
      .select('id, funnel_page_id, form_id, question_text, question_order, answer_type, qualifying_answer, options, placeholder, is_qualifying, is_required, created_at')
      .eq('form_id', qualificationFormId)
      .order('question_order', { ascending: true });
  } else {
    query = supabase
      .from('qualification_questions')
      .select('id, funnel_page_id, form_id, question_text, question_order, answer_type, qualifying_answer, options, placeholder, is_qualifying, is_required, created_at')
      .eq('funnel_page_id', funnelPageId)
      .order('question_order', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    return { questions: [], error: error.message };
  }

  const questions = (data as QualificationQuestionRow[]).map(qualificationQuestionFromRow);
  return { questions, error: null };
}

/**
 * Resolve qualification questions for public pages (limited fields, no qualifying info exposed).
 * Returns raw rows with only the fields needed for the public form.
 */
export async function resolvePublicQuestionsForFunnel(
  supabase: SupabaseClient,
  funnelPageId: string,
  qualificationFormId: string | null
): Promise<{ questions: Array<{
  id: string;
  question_text: string;
  question_order: number;
  answer_type: string;
  options: string[] | null;
  placeholder: string | null;
  is_required: boolean;
}>; error: string | null }> {
  const selectFields = 'id, question_text, question_order, answer_type, options, placeholder, is_required';

  let query;
  if (qualificationFormId) {
    query = supabase
      .from('qualification_questions')
      .select(selectFields)
      .eq('form_id', qualificationFormId)
      .order('question_order', { ascending: true });
  } else {
    query = supabase
      .from('qualification_questions')
      .select(selectFields)
      .eq('funnel_page_id', funnelPageId)
      .order('question_order', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    return { questions: [], error: error.message };
  }

  return { questions: data || [], error: null };
}

/**
 * Resolve questions with full qualification data for the PATCH lead endpoint.
 * Includes qualifying_answer, is_qualifying, etc.
 */
export async function resolveFullQuestionsForFunnel(
  supabase: SupabaseClient,
  funnelPageId: string,
  qualificationFormId: string | null
): Promise<{ questions: Array<{
  id: string;
  question_text: string;
  answer_type: string;
  qualifying_answer: unknown;
  is_qualifying: boolean;
  is_required: boolean;
}>; error: string | null }> {
  const selectFields = 'id, question_text, answer_type, qualifying_answer, is_qualifying, is_required';

  let query;
  if (qualificationFormId) {
    query = supabase
      .from('qualification_questions')
      .select(selectFields)
      .eq('form_id', qualificationFormId)
      .order('question_order', { ascending: true });
  } else {
    query = supabase
      .from('qualification_questions')
      .select(selectFields)
      .eq('funnel_page_id', funnelPageId)
      .order('question_order', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    return { questions: [], error: error.message };
  }

  return { questions: data || [], error: null };
}
