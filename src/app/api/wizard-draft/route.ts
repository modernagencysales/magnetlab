// API Route: Wizard Draft Auto-Save
// GET /api/wizard-draft - List all drafts for user
// PUT /api/wizard-draft - Create or update a draft
// DELETE /api/wizard-draft - Delete a specific draft

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import type { WizardState } from '@/lib/types/lead-magnet';

function deriveDraftTitle(wizardState: WizardState): string {
  // Use selected concept title if available
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

// GET - List all drafts for user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    let query = supabase
      .from('extraction_sessions')
      .select('id, wizard_state, current_step, draft_title, updated_at')
      .or('expires_at.is.null,expires_at.gt.now()')
      .not('wizard_state', 'eq', '{}')
      .order('updated_at', { ascending: false });
    query = applyScope(query, scope);

    const { data, error } = await query;

    if (error) {
      logApiError('wizard-draft/list', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch drafts');
    }

    return NextResponse.json({ drafts: data || [] });
  } catch (error) {
    logApiError('wizard-draft/list', error);
    return ApiErrors.internalError('Failed to fetch drafts');
  }
}

// PUT - Create or update a draft
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { id, wizardState } = body as { id?: string; wizardState: WizardState };

    if (!wizardState || typeof wizardState !== 'object') {
      return ApiErrors.validationError('wizardState is required');
    }

    // Guard against oversized payloads
    const payloadSize = JSON.stringify(wizardState).length;
    if (payloadSize > 500_000) {
      return ApiErrors.validationError('Draft payload too large');
    }

    if (id && !isValidUUID(id)) {
      return ApiErrors.validationError('Invalid draft ID');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);
    const draftTitle = deriveDraftTitle(wizardState);

    if (id) {
      // Update existing draft
      const { error } = await supabase
        .from('extraction_sessions')
        .update({
          wizard_state: wizardState,
          current_step: wizardState.currentStep,
          draft_title: draftTitle,
          extraction_answers: wizardState.extractionAnswers || {},
          selected_concept_index: wizardState.selectedConceptIndex,
        })
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (error) {
        logApiError('wizard-draft/update', error, { userId: session.user.id, draftId: id });
        return ApiErrors.databaseError('Failed to update draft');
      }

      return NextResponse.json({ id });
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from('extraction_sessions')
        .insert({
          user_id: session.user.id,
          team_id: scope.teamId || null,
          wizard_state: wizardState,
          current_step: wizardState.currentStep,
          draft_title: draftTitle,
          extraction_answers: wizardState.extractionAnswers || {},
          selected_concept_index: wizardState.selectedConceptIndex,
          expires_at: null, // Never expires
        })
        .select('id')
        .single();

      if (error) {
        logApiError('wizard-draft/create', error, { userId: session.user.id });
        return ApiErrors.databaseError('Failed to create draft');
      }

      return NextResponse.json({ id: data.id });
    }
  } catch (error) {
    logApiError('wizard-draft/save', error);
    return ApiErrors.internalError('Failed to save draft');
  }
}

// DELETE - Delete a specific draft
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { id } = body as { id: string };

    if (!id || !isValidUUID(id)) {
      return ApiErrors.validationError('Valid draft ID is required');
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('extraction_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      logApiError('wizard-draft/delete', error, { userId: session.user.id, draftId: id });
      return ApiErrors.databaseError('Failed to delete draft');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('wizard-draft/delete', error);
    return ApiErrors.internalError('Failed to delete draft');
  }
}
