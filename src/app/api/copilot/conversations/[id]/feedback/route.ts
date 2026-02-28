import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// POST — add feedback to a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: conversationId } = await params;
  const { messageId, rating, note } = await req.json();

  if (!messageId || !rating) {
    return NextResponse.json({ error: 'messageId and rating are required' }, { status: 400 });
  }

  if (!['positive', 'negative'].includes(rating)) {
    return NextResponse.json({ error: 'rating must be positive or negative' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify conversation belongs to user
  const { data: conv } = await supabase
    .from('copilot_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', session.user.id)
    .single();

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  const { error } = await supabase
    .from('copilot_messages')
    .update({
      feedback: { rating, note: note || null, timestamp: new Date().toISOString() },
    })
    .eq('id', messageId)
    .eq('conversation_id', conversationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
