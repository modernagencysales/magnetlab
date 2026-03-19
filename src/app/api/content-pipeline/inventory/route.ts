/**
 * Content Pipeline — Inventory Route
 * GET /api/content-pipeline/inventory
 * Returns counts and health indicators for all 7 ingredient types for a team profile.
 * Never contains business logic; delegates to mixer.service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { InventoryQuerySchema } from '@/lib/validations/mixer';
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
    const parsed = InventoryQuerySchema.safeParse({
      team_profile_id: searchParams.get('team_profile_id'),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const inventory = await mixerService.getInventory(parsed.data.team_profile_id);
    return NextResponse.json({ inventory });
  } catch (error) {
    logError('cp/inventory', error, { step: 'inventory_error' });
    const status = mixerService.getStatusCode(error);
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
