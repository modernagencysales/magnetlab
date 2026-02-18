'use client';

import Link from 'next/link';

export default function Troubleshooting() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Troubleshooting</h1>
      <p className="text-muted-foreground mb-8">Common issues and how to fix them.</p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Webhook Not Firing</h2>

      <h3 className="text-lg font-medium mt-6 mb-3">Check: Is the webhook active?</h3>
      <p className="text-sm">
        Go to{' '}
        <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">
          Settings
        </Link>{' '}
        &rarr; Webhooks. Make sure the toggle is ON.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Check: Is the URL correct?</h3>
      <p className="text-sm">Webhooks must use HTTPS. HTTP URLs are rejected.</p>

      <h3 className="text-lg font-medium mt-6 mb-3">Test it manually</h3>
      <p className="text-sm">
        Click the <strong>Test</strong> button next to your webhook. If the test succeeds but real
        leads don&apos;t trigger it, the issue is likely on the receiving end.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Check your automation tool</h3>
      <p className="text-sm">
        Make sure your Zap/scenario/workflow is active and not paused.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Leads Not Appearing in Email Platform</h2>

      <h3 className="text-lg font-medium mt-6 mb-3">Check field mapping</h3>
      <p className="text-sm">
        In your automation tool, verify that{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.email</code> is
        mapped to the email field. A common mistake is mapping the top-level{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">email</code> instead of{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.email</code>.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Check the automation tool logs</h3>
      <p className="text-sm">
        Zapier: check Task History. Make: check scenario logs. n8n: check execution history.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Verify the webhook fires twice</h3>
      <p className="text-sm">
        The webhook fires on opt-in (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">lead.created</code>)
        AND on qualification (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">lead.qualified</code>).
        If your automation adds contacts on both events, you might get duplicates. Filter by event
        type.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Page Not Publishing</h2>

      <h3 className="text-lg font-medium mt-6 mb-3">Set your username</h3>
      <p className="text-sm">
        Go to{' '}
        <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">
          Settings
        </Link>{' '}
        and set a username. Your page URL uses it:{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          magnetlab.ai/p/your-username/slug
        </code>
        .
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Check: Is the slug unique?</h3>
      <p className="text-sm">Each funnel needs a unique URL slug.</p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Page Shows 404</h2>

      <h3 className="text-lg font-medium mt-6 mb-3">Check: Is it published?</h3>
      <p className="text-sm">
        Open the funnel builder and check if the <strong>Publish</strong> button shows
        &ldquo;Published&rdquo; status.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Check the URL</h3>
      <p className="text-sm">
        The URL is case-sensitive. Make sure it matches exactly:{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          magnetlab.ai/p/username/slug
        </code>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Qualification Not Working</h2>

      <h3 className="text-lg font-medium mt-6 mb-3">Add scoring questions</h3>
      <p className="text-sm">
        Text and textarea questions don&apos;t affect qualification. You need at least one Yes/No or
        Multiple Choice question for the qualification logic to work.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Check pass/fail messages</h3>
      <p className="text-sm">
        In the Thank-You Page tab, set both the &ldquo;qualified&rdquo; and &ldquo;not
        qualified&rdquo; messages.
      </p>

      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          Still stuck? Check the{' '}
          <Link
            href="/docs/connect-email-list"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            webhook setup guide
          </Link>{' '}
          for detailed integration instructions.
        </p>
      </div>
    </div>
  );
}
