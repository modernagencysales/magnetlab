'use client';

import Link from 'next/link';

export default function DirectApi() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Direct API / Webhook</h1>
      <p className="text-muted-foreground mb-8">
        Receive lead data directly via HTTP webhook. Build your own integration or connect to any
        tool that accepts webhooks.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Webhook Format</h2>
      <p className="text-sm mb-4">
        MagnetLab sends a POST request to your webhook URL with a JSON body.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Headers</h2>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-semibold">Header</th>
              <th className="text-left py-2 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  Content-Type
                </code>
              </td>
              <td className="py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  application/json
                </code>
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  X-Webhook-Event
                </code>
              </td>
              <td className="py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  lead.created
                </code>{' '}
                or{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  lead.qualified
                </code>
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  X-Webhook-Id
                </code>
              </td>
              <td className="py-2">Unique delivery ID (use for idempotency)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  X-Webhook-Attempt
                </code>
              </td>
              <td className="py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">1</code>,{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">2</code>, or{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">3</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Payload</h2>
      <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto my-4">
{`{
  "event": "lead.created",
  "timestamp": "2025-01-26T12:00:00Z",
  "data": {
    "leadId": "uuid",
    "email": "lead@example.com",
    "name": "John Doe",
    "isQualified": null,
    "qualificationAnswers": null,
    "surveyAnswers": null,
    "leadMagnetTitle": "Your Lead Magnet",
    "funnelPageSlug": "your-page",
    "utmSource": "linkedin",
    "utmMedium": "social",
    "utmCampaign": "launch",
    "createdAt": "2025-01-26T12:00:00Z"
  }
}`}
      </pre>

      <h2 className="text-xl font-semibold mt-8 mb-4">Events</h2>
      <p className="text-sm mb-4">Two events fire:</p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          <span>
            <strong>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                lead.created
              </code>
            </strong>{' '}
            &mdash; immediately when someone submits their email.{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">isQualified</code>,{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              qualificationAnswers
            </code>
            , and{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">surveyAnswers</code>{' '}
            will be null.
          </span>
        </li>
        <li>
          <span>
            <strong>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                lead.qualified
              </code>
            </strong>{' '}
            &mdash; after they complete the qualification survey (if configured). All fields
            populated.
          </span>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Retry Behavior</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>3 attempts with exponential backoff</li>
        <li>10-second timeout per attempt</li>
        <li>Return a 2xx status code to acknowledge receipt</li>
        <li>
          Use{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">X-Webhook-Id</code>{' '}
          to deduplicate if you receive the same event twice
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Example: Express.js</h2>
      <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto my-4">
{`app.post('/webhook/magnetlab', (req, res) => {
  const { event, data } = req.body;

  if (event === 'lead.created') {
    // Add to your email list
    console.log('New lead:', data.email, data.name);
  }

  if (event === 'lead.qualified' && data.isQualified) {
    // Move to qualified segment
    console.log('Qualified:', data.email);
  }

  res.sendStatus(200);
});`}
      </pre>

      <h2 className="text-xl font-semibold mt-8 mb-4">Example: Python (Flask)</h2>
      <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto my-4">
{`@app.route('/webhook/magnetlab', methods=['POST'])
def magnetlab_webhook():
    payload = request.get_json()
    event = payload['event']
    data = payload['data']

    if event == 'lead.created':
        # Add to your email list
        print(f"New lead: {data['email']}")

    if event == 'lead.qualified' and data['isQualified']:
        # Move to qualified segment
        print(f"Qualified: {data['email']}")

    return '', 200`}
      </pre>

      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          &larr;{' '}
          <Link
            href="/docs/connect-email-list"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Back to Connect to Your Email List
          </Link>
        </p>
      </div>
    </div>
  );
}
