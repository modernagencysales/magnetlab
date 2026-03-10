import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as signalsRepo from '@/server/repositories/signals.repo';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await signalsRepo.listCustomVariables(session.user.id);
  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ variables: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, field_type, scoring_rule, display_order } = body;

  if (!name || !field_type || !scoring_rule) {
    return NextResponse.json(
      { error: 'name, field_type, and scoring_rule are required' },
      { status: 400 }
    );
  }

  const { data, error } = await signalsRepo.upsertCustomVariable(session.user.id, {
    name,
    field_type,
    scoring_rule,
    display_order: display_order ?? 0,
  });

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ variable: data });
}
