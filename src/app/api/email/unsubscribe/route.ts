import { NextRequest } from 'next/server';
import { generateUnsubscribeToken } from '@/lib/integrations/resend';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function page(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #fafafa;
      color: #333;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 48px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { font-size: 24px; margin: 0 0 16px; }
    p { font-size: 16px; line-height: 1.5; color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sid = searchParams.get('sid');
  const token = searchParams.get('token');

  // Validate params
  if (!sid || !token) {
    return htmlResponse(
      page('Invalid Link', 'Invalid unsubscribe link. Missing required parameters.'),
      400
    );
  }

  // Verify HMAC token
  const expectedToken = generateUnsubscribeToken(sid);
  if (expectedToken !== token) {
    return htmlResponse(
      page('Invalid Link', 'Invalid unsubscribe link. The token could not be verified.'),
      403
    );
  }

  // Unsubscribe the subscriber
  const supabase = createSupabaseAdminClient();

  // Update subscriber status
  const { error: subscriberError } = await supabase
    .from('email_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', sid);

  if (subscriberError) {
    return htmlResponse(
      page('Error', 'Something went wrong while processing your request. Please try again later.'),
      500
    );
  }

  // Deactivate any active flow contacts for this subscriber
  await supabase
    .from('email_flow_contacts')
    .update({ status: 'unsubscribed' })
    .eq('subscriber_id', sid)
    .eq('status', 'active');

  return htmlResponse(
    page(
      'Unsubscribed',
      "You've been successfully unsubscribed. You will no longer receive emails from us."
    )
  );
}
