import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// GET — get conversation with messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: conversation, error: convError } = await supabase
    .from('copilot_conversations')
    .select('id, title, entity_type, entity_id, model, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from('copilot_messages')
    .select('id, role, content, tool_name, tool_args, tool_result, feedback, tokens_used, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ conversation, messages: messages || [] });
}

// DELETE — delete conversation
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('copilot_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
