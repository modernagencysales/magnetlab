/**
 * Content Pipeline — Recipes Route
 * GET /api/content-pipeline/recipes
 * Returns top N suggested recipes for a team profile based on past combo performance.
 * Never contains business logic; delegates to mixer.service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { RecipeQuerySchema } from '@/lib/validations/mixer';
import { formatZodError } from '@/lib/validations/api';
import * as mixerService from '@/server/services/mixer.service';

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const parsed = RecipeQuerySchema.safeParse({
      team_profile_id: searchParams.get('team_profile_id'),
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const recipes = await mixerService.getSuggestedRecipes(
      parsed.data.team_profile_id,
      parsed.data.limit
    );
    return NextResponse.json({ recipes });
  } catch (error) {
    logError('cp/recipes', error, { step: 'recipes_error' });
    const status = mixerService.getStatusCode(error);
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
