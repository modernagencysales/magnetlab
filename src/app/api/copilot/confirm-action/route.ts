import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { conversationId, toolUseId, approved } = body;

  if (!conversationId || !toolUseId || typeof approved !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required fields: conversationId, toolUseId, approved' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Verify conversation ownership
  const { data: conversation } = await supabase
    .from('copilot_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', session.user.id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Save confirmation decision as a copilot_messages row
  await supabase.from('copilot_messages').insert({
    conversation_id: conversationId,
    role: 'tool_result',
    tool_name: '_confirmation',
    tool_result: { toolUseId, approved },
  });

  return NextResponse.json({ success: true });
}
