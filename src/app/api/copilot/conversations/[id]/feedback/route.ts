import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { extractMemories } from '@/lib/ai/copilot/memory-extractor';

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

  // Fire-and-forget: extract memories from negative feedback with notes
  if (rating === 'negative' && note) {
    const userId = session.user.id;
    (async () => {
      const { data: context } = await supabase
        .from('copilot_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(6);

      const contextMsgs = (context || [])
        .reverse()
        .filter((m: { role: string; content: string | null }) => m.role === 'user' || m.role === 'assistant')
        .map((m: { role: string; content: string | null }) => ({ role: m.role, content: m.content || '' }));

      contextMsgs.push({ role: 'user', content: `[Feedback note]: ${note}` });

      const memories = await extractMemories(userId, contextMsgs);
      if (memories.length > 0) {
        await supabase.from('copilot_memories').insert(
          memories.map(m => ({
            user_id: userId,
            rule: m.rule,
            category: m.category,
            confidence: m.confidence,
            source: 'feedback' as const,
            conversation_id: conversationId,
          }))
        );
      }
    })().catch(() => {});
  }

  return NextResponse.json({ success: true });
}
