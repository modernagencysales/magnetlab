// API Route: Wizard Draft Auto-Save
// GET — list drafts; PUT — create/update; DELETE — delete

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as wizardDraftService from '@/server/services/wizard-draft.service';
import type { WizardState } from '@/lib/types/lead-magnet';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const result = await wizardDraftService.listDrafts(scope);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('wizard-draft/list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to fetch drafts');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { id, wizardState } = body as { id?: string; wizardState: WizardState };

    if (!wizardState || typeof wizardState !== 'object') {
      return ApiErrors.validationError('wizardState is required');
    }
    if (JSON.stringify(wizardState).length > 500_000) {
      return ApiErrors.validationError('Draft payload too large');
    }
    if (id && !isValidUUID(id)) return ApiErrors.validationError('Invalid draft ID');

    const scope = await getDataScope(session.user.id);
    const result = await wizardDraftService.saveDraft(session.user.id, scope, id, wizardState);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('wizard-draft/save', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to save draft');
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { id } = body as { id: string };

    if (!id || !isValidUUID(id)) return ApiErrors.validationError('Valid draft ID is required');

    await wizardDraftService.deleteDraft(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('wizard-draft/delete', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to delete draft');
  }
}
