import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as signalsRepo from '@/server/repositories/signals.repo';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: _id } = await params;
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { error } = await signalsRepo.deleteCustomVariable(id, session.user.id);

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
