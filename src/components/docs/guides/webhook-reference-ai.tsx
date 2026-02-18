'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Link from 'next/link';

const AI_REFERENCE = `You are helping someone connect their MagnetLab landing page to their email marketing platform.

## What MagnetLab Does
MagnetLab is a platform for creating AI-powered landing pages. When someone fills out a form on a MagnetLab page, a webhook (HTTP POST request) fires to a URL the user configures.

## Webhook Configuration
1. Log into MagnetLab at magnetlab.ai
2. Go to Settings → Webhooks
3. Click "Add Webhook"
4. Enter a name and the HTTPS URL from your automation tool
5. Click Save
6. Click "Test" to send a test payload

## Events
- lead.created — fires when someone submits their email on the landing page
- lead.qualified — fires after they complete the qualification survey (if one is configured)

## Webhook Payload (lead.created)
POST request with JSON body:

{
  "event": "lead.created",
  "timestamp": "2025-01-26T12:00:00Z",
  "data": {
    "leadId": "unique-uuid-string",
    "email": "lead@example.com",
    "name": "John Doe",
    "isQualified": null,
    "qualificationAnswers": null,
    "surveyAnswers": null,
    "leadMagnetTitle": "Name of the lead magnet they opted into",
    "funnelPageSlug": "url-slug-of-the-page",
    "utmSource": "linkedin (or null)",
    "utmMedium": "social (or null)",
    "utmCampaign": "campaign-name (or null)",
    "createdAt": "2025-01-26T12:00:00Z"
  }
}

## Webhook Payload (lead.qualified)
Same structure, but with qualification data filled in:
- isQualified: true or false
- qualificationAnswers: {"question_id": "answer_value", ...}
- surveyAnswers: {"question_slug": "answer_value", ...}

## HTTP Headers Sent
- Content-Type: application/json
- X-Webhook-Event: "lead.created" or "lead.qualified"
- X-Webhook-Id: unique delivery ID (use for deduplication)
- X-Webhook-Attempt: "1", "2", or "3"

## Retry Behavior
- 3 attempts with exponential backoff
- 10-second timeout per attempt
- Endpoint should return 2xx to acknowledge

## Common Integration Patterns
- Zapier: Use "Webhooks by Zapier" trigger → "Catch Hook". Map data.email to Email, data.name to Name.
- Make (Integromat): Use "Webhooks" → "Custom webhook". Map fields from the data object.
- n8n: Use "Webhook" trigger node, method POST. Access fields as {{ $json.data.email }}.
- ConvertKit: Use Zapier/Make as middleware. Map email to subscriber email, use tags for segmentation.
- Mailchimp: Use Zapier/Make as middleware. Map email to subscriber, data.leadMagnetTitle as tag.
- ActiveCampaign: Use Zapier/Make as middleware. Map email to contact, use automations for follow-up.
- Direct code: Accept POST at your endpoint, parse JSON body, return 200.`;

export default function WebhookReferenceAI() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(AI_REFERENCE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">AI-Friendly Webhook Reference</h1>
      <p className="text-muted-foreground mb-8">
        This page contains a self-contained reference document designed to be copied and pasted into
        ChatGPT, Claude, or any AI assistant. It has everything the AI needs to help you connect
        MagnetLab to your specific email platform.
      </p>

      {/* Copy button - prominent, at the top */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors mb-8"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied!' : 'Copy AI Reference to Clipboard'}
      </button>

      {/* The reference content displayed for reading */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        {/* What MagnetLab Does */}
        <section>
          <h2 className="text-xl font-semibold mb-3">What MagnetLab Does</h2>
          <p className="text-sm">
            MagnetLab is a platform for creating AI-powered landing pages. When someone fills out a
            form on a MagnetLab page, a webhook (HTTP POST request) fires to a URL the user
            configures.
          </p>
        </section>

        {/* Webhook Configuration */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Webhook Configuration</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Log into MagnetLab at magnetlab.ai</li>
            <li>
              Go to <strong>Settings</strong> &rarr; <strong>Webhooks</strong>
            </li>
            <li>
              Click <strong>&ldquo;Add Webhook&rdquo;</strong>
            </li>
            <li>Enter a name and the HTTPS URL from your automation tool</li>
            <li>Click Save</li>
            <li>Click &ldquo;Test&rdquo; to send a test payload</li>
          </ol>
        </section>

        {/* Events */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Events</h2>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                lead.created
              </code>{' '}
              &mdash; fires when someone submits their email on the landing page
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                lead.qualified
              </code>{' '}
              &mdash; fires after they complete the qualification survey (if one is configured)
            </li>
          </ul>
        </section>

        {/* Webhook Payload (lead.created) */}
        <section>
          <h2 className="text-xl font-semibold mb-3">
            Webhook Payload (
            <code className="text-lg font-mono">lead.created</code>)
          </h2>
          <p className="text-sm mb-3">POST request with JSON body:</p>
          <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto">
{`{
  "event": "lead.created",
  "timestamp": "2025-01-26T12:00:00Z",
  "data": {
    "leadId": "unique-uuid-string",
    "email": "lead@example.com",
    "name": "John Doe",
    "isQualified": null,
    "qualificationAnswers": null,
    "surveyAnswers": null,
    "leadMagnetTitle": "Name of the lead magnet they opted into",
    "funnelPageSlug": "url-slug-of-the-page",
    "utmSource": "linkedin (or null)",
    "utmMedium": "social (or null)",
    "utmCampaign": "campaign-name (or null)",
    "createdAt": "2025-01-26T12:00:00Z"
  }
}`}
          </pre>
        </section>

        {/* Webhook Payload (lead.qualified) */}
        <section>
          <h2 className="text-xl font-semibold mb-3">
            Webhook Payload (
            <code className="text-lg font-mono">lead.qualified</code>)
          </h2>
          <p className="text-sm mb-2">Same structure, but with qualification data filled in:</p>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">isQualified</code>
              : true or false
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                qualificationAnswers
              </code>
              :{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {`{"question_id": "answer_value", ...}`}
              </code>
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                surveyAnswers
              </code>
              :{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {`{"question_slug": "answer_value", ...}`}
              </code>
            </li>
          </ul>
        </section>

        {/* HTTP Headers */}
        <section>
          <h2 className="text-xl font-semibold mb-3">HTTP Headers Sent</h2>
          <div className="overflow-x-auto">
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
                  <td className="py-2">Unique delivery ID (use for deduplication)</td>
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
        </section>

        {/* Retry Behavior */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Retry Behavior</h2>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>3 attempts with exponential backoff</li>
            <li>10-second timeout per attempt</li>
            <li>Endpoint should return 2xx to acknowledge</li>
          </ul>
        </section>

        {/* Common Integration Patterns */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Common Integration Patterns</h2>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">Zapier</p>
              <p className="text-muted-foreground mt-1">
                Use &ldquo;Webhooks by Zapier&rdquo; trigger &rarr; &ldquo;Catch Hook&rdquo;. Map{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.email</code>{' '}
                to Email,{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.name</code>{' '}
                to Name.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">Make (Integromat)</p>
              <p className="text-muted-foreground mt-1">
                Use &ldquo;Webhooks&rdquo; &rarr; &ldquo;Custom webhook&rdquo;. Map fields from the{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data</code>{' '}
                object.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">n8n</p>
              <p className="text-muted-foreground mt-1">
                Use &ldquo;Webhook&rdquo; trigger node, method POST. Access fields as{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  {'{{ $json.data.email }}'}
                </code>
                .
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">ConvertKit</p>
              <p className="text-muted-foreground mt-1">
                Use Zapier/Make as middleware. Map email to subscriber email, use tags for
                segmentation.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">Mailchimp</p>
              <p className="text-muted-foreground mt-1">
                Use Zapier/Make as middleware. Map email to subscriber,{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  data.leadMagnetTitle
                </code>{' '}
                as tag.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">ActiveCampaign</p>
              <p className="text-muted-foreground mt-1">
                Use Zapier/Make as middleware. Map email to contact, use automations for follow-up.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">Direct Code</p>
              <p className="text-muted-foreground mt-1">
                Accept POST at your endpoint, parse JSON body, return 200.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Back link */}
      <p className="mt-8">
        <Link
          href="/docs/connect-email-list"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          &larr; Back to Connect to Your Email List
        </Link>
      </p>
    </div>
  );
}
