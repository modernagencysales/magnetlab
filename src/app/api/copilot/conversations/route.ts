import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// GET — list conversations
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('copilot_conversations')
    .select('id, title, entity_type, entity_id, model, created_at, updated_at')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data || [] });
}

// POST — create conversation
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('copilot_conversations')
    .insert({
      user_id: session.user.id,
      title: body.title || 'New conversation',
      entity_type: body.entityType || null,
      entity_id: body.entityId || null,
    })
    .select('id, title, entity_type, entity_id, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
