import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { executeAction } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions';
import { getDataScope } from '@/lib/utils/team-context';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { conversationId, toolUseId, approved, toolName, toolArgs } = body;

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

  if (approved && toolName && toolArgs) {
    // Execute the confirmed action
    const scope = await getDataScope(session.user.id);
    const actionCtx: ActionContext = { scope };

    const result = await executeAction(actionCtx, toolName, toolArgs);

    // Update the stale awaiting_confirmation tool_result with the real result
    // Find it by matching tool_name + awaiting_confirmation in this conversation
    const { data: staleMsg } = await supabase
      .from('copilot_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('role', 'tool_result')
      .eq('tool_name', toolName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (staleMsg) {
      await supabase
        .from('copilot_messages')
        .update({ tool_result: result })
        .eq('id', staleMsg.id);
    }

    return NextResponse.json({ success: true, executed: true, result });
  }

  // Denied — save denial as a message so Claude sees it in history
  await supabase.from('copilot_messages').insert({
    conversation_id: conversationId,
    role: 'tool_result',
    tool_name: '_confirmation',
    tool_result: { toolUseId, approved: false },
  });

  return NextResponse.json({ success: true, executed: false });
}
