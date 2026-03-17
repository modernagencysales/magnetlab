/**
 * Creative Strategy Play Feedback Route — GET + POST.
 * Any authenticated user can view/submit feedback.
 * Delegates to cs-plays service. Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { playFeedbackSchema } from '@/lib/validations/creative-strategy';
import * as playsService from '@/server/services/cs-plays.service';
import { logError } from '@/lib/utils/logger';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const feedback = await playsService.getFeedbackByPlayId(id);
    return NextResponse.json(feedback);
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays/[id]/feedback.GET', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = playFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const feedback = await playsService.submitFeedback(id, session.user.id, parsed.data);
    return NextResponse.json(feedback, { status: 201 });
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays/[id]/feedback.POST', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
