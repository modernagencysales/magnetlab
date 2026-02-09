import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = process.env.TRANSCRIPT_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    // Build the webhook URL for this user
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
    const webhookUrl = `${baseUrl}/api/webhooks/transcript?secret=${secret}&user_id=${session.user.id}`;

    // Payload example
    const examplePayload = {
      source: 'fathom',
      recording_id: 'unique-id-from-your-tool',
      title: 'Client Discovery Call',
      date: new Date().toISOString(),
      duration_minutes: 45,
      participants: ['alice@example.com'],
      transcript: 'Full transcript text goes here...',
    };

    return NextResponse.json({
      webhook_url: webhookUrl,
      user_id: session.user.id,
      example_payload: examplePayload,
    });
  } catch (error) {
    console.error('Webhook config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
