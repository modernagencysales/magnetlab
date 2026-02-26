// API Route: External Quiz Generation
// POST /api/external/generate-quiz
//
// Generates qualification quiz questions using AI, creates a qualification form,
// inserts questions, and links the form to the funnel page.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { generateQuizQuestions } from '@/lib/ai/content-pipeline/quiz-generator';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';

// ============================================
// AUTHENTICATION
// ============================================

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external/generate-quiz/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: Request) {
  try {
    // Step 1: Authenticate
    if (!authenticateRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    // Step 2: Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const {
      userId,
      funnelPageId,
      clientName,
      icpData,
      teamId,
      profileId,
    } = body as {
      userId?: string;
      funnelPageId?: string;
      clientName?: string;
      icpData?: Record<string, unknown>;
      teamId?: string;
      profileId?: string;
    };

    if (!userId || typeof userId !== 'string') {
      return ApiErrors.validationError('userId is required');
    }
    if (!funnelPageId || typeof funnelPageId !== 'string') {
      return ApiErrors.validationError('funnelPageId is required');
    }

    const supabase = createSupabaseAdminClient();

    // Step 3: Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return ApiErrors.notFound('User');
    }

    // Step 4: Verify funnel page exists and belongs to user
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, user_id')
      .eq('id', funnelPageId)
      .eq('user_id', userId)
      .single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Step 5: Gather knowledge context (non-fatal)
    let knowledgeContext = '';
    try {
      // Search for market intelligence, objections, and questions
      const categories = ['market_intel', 'objection', 'question'] as const;
      const contextParts: string[] = [];

      for (const knowledgeType of categories) {
        const result = await searchKnowledgeV2(userId, {
          knowledgeType,
          limit: 5,
          teamId: teamId || undefined,
          profileId: profileId || undefined,
        });

        if (result.entries.length > 0) {
          const entries = result.entries.map((e) => e.content).join('\n- ');
          contextParts.push(`${knowledgeType}:\n- ${entries}`);
        }
      }

      if (contextParts.length > 0) {
        knowledgeContext = contextParts.join('\n\n');
      }
    } catch (err) {
      // Non-fatal — log and continue
      logApiError('external/generate-quiz/knowledge', err, { userId });
    }

    // Step 6: Gather brand context
    let brandContext = '';
    try {
      // Try team-level first
      let brandKit = null;

      if (teamId) {
        const { data } = await supabase
          .from('brand_kits')
          .select('urgent_pains, frequent_questions, credibility_markers')
          .eq('team_id', teamId)
          .limit(1)
          .single();
        if (data) brandKit = data;
      }

      // Fallback to user-level
      if (!brandKit) {
        const { data: ownerProfile } = await supabase
          .from('team_profiles')
          .select('team_id')
          .eq('user_id', userId)
          .eq('role', 'owner')
          .limit(1)
          .single();

        if (ownerProfile?.team_id) {
          const { data } = await supabase
            .from('brand_kits')
            .select('urgent_pains, frequent_questions, credibility_markers')
            .eq('team_id', ownerProfile.team_id)
            .limit(1)
            .single();
          if (data) brandKit = data;
        }
      }

      if (!brandKit) {
        const { data } = await supabase
          .from('brand_kits')
          .select('urgent_pains, frequent_questions, credibility_markers')
          .eq('user_id', userId)
          .limit(1)
          .single();
        if (data) brandKit = data;
      }

      if (brandKit) {
        const parts: string[] = [];
        const pains = brandKit.urgent_pains as string[] | null;
        const questions = brandKit.frequent_questions as string[] | null;
        const markers = brandKit.credibility_markers as string[] | null;

        if (pains && pains.length > 0) {
          parts.push(`Urgent pains: ${pains.join(', ')}`);
        }
        if (questions && questions.length > 0) {
          parts.push(`Frequent questions: ${questions.join(', ')}`);
        }
        if (markers && markers.length > 0) {
          parts.push(`Credibility markers: ${markers.join(', ')}`);
        }
        if (parts.length > 0) {
          brandContext = parts.join('\n');
        }
      }
    } catch (err) {
      // Non-fatal
      logApiError('external/generate-quiz/brand-context', err, { userId });
    }

    // Step 7: Generate quiz questions via AI
    const resolvedClientName = clientName || user.name || 'the client';
    const icpJson = icpData ? JSON.stringify(icpData) : '{}';

    const questions = await generateQuizQuestions({
      clientName: resolvedClientName,
      icpJson,
      knowledgeContext,
      brandContext,
    });

    if (questions.length === 0) {
      return ApiErrors.aiError('Quiz generation produced no valid questions');
    }

    // Step 8: Create qualification form
    const { data: form, error: formError } = await supabase
      .from('qualification_forms')
      .insert({
        user_id: userId,
        name: `Quiz for ${resolvedClientName}`,
      })
      .select('id')
      .single();

    if (formError || !form) {
      logApiError('external/generate-quiz/create-form', formError, { userId });
      return ApiErrors.databaseError('Failed to create qualification form');
    }

    // Step 9: Insert qualification questions
    const questionRows = questions.map((q, index) => ({
      form_id: form.id,
      funnel_page_id: null,
      question_text: q.question_text,
      question_order: index,
      answer_type: q.answer_type,
      qualifying_answer: q.qualifying_answer,
      options: q.options,
      placeholder: null,
      is_qualifying: q.is_qualifying,
      is_required: q.is_required,
    }));

    const { error: questionsError } = await supabase
      .from('qualification_questions')
      .insert(questionRows);

    if (questionsError) {
      logApiError('external/generate-quiz/insert-questions', questionsError, { formId: form.id });
      return ApiErrors.databaseError('Failed to insert quiz questions');
    }

    // Step 10: Link form to funnel page
    const { error: linkError } = await supabase
      .from('funnel_pages')
      .update({ qualification_form_id: form.id })
      .eq('id', funnelPageId);

    if (linkError) {
      logApiError('external/generate-quiz/link-form', linkError, { funnelPageId, formId: form.id });
      return ApiErrors.databaseError('Failed to link quiz to funnel page');
    }

    return NextResponse.json({
      success: true,
      formId: form.id,
      questionCount: questions.length,
    });
  } catch (error) {
    logApiError('external/generate-quiz', error);
    return ApiErrors.internalError('An unexpected error occurred during quiz generation');
  }
}
