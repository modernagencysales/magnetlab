'use client';

import Link from 'next/link';

export default function Zapier() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Connect with Zapier</h1>
      <p className="text-muted-foreground mb-8">
        Connect MagnetLab to your email platform using Zapier. No code required.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">What You&apos;ll Need</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>A Zapier account (free tier works)</li>
        <li>
          Your email platform connected to Zapier (Mailchimp, ConvertKit, ActiveCampaign, etc.)
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step-by-Step</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          <span>
            In Zapier, click <strong>Create</strong> &rarr; <strong>New Zap</strong>
          </span>
        </li>
        <li>
          <span>
            For the trigger, search for <strong>&ldquo;Webhooks by Zapier&rdquo;</strong>
          </span>
        </li>
        <li>
          <span>
            Choose <strong>&ldquo;Catch Hook&rdquo;</strong> as the trigger event
          </span>
        </li>
        <li>
          <span>
            Zapier gives you a webhook URL &mdash; <strong>copy it</strong>
          </span>
        </li>
        <li>
          <span>
            In MagnetLab, go to{' '}
            <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">
              Settings
            </Link>{' '}
            &rarr; <strong>Webhooks</strong> &rarr; <strong>Add Webhook</strong>
          </span>
        </li>
        <li>
          <span>
            Name it (e.g., &ldquo;Zapier &rarr; Mailchimp&rdquo;), paste the URL, and save
          </span>
        </li>
        <li>
          <span>
            Click <strong>Test</strong> in MagnetLab to send a test payload
          </span>
        </li>
        <li>
          <span>
            Back in Zapier, click <strong>Test trigger</strong> &mdash; you should see the test data
          </span>
        </li>
        <li>
          <span>
            Add an <strong>Action step</strong>: search for your email platform
          </span>
        </li>
        <li>
          <span>
            Map the fields:
          </span>
          <ul className="list-disc list-inside space-y-2 text-sm mt-2 ml-6">
            <li>
              Email:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                data &rarr; email
              </code>
            </li>
            <li>
              Name:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                data &rarr; name
              </code>
            </li>
            <li>Tags/Lists: choose your target list</li>
          </ul>
        </li>
        <li>
          <span>
            <strong>Turn on your Zap</strong>
          </span>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Tips</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            Use Zapier&apos;s &ldquo;Filter&rdquo; step to only sync qualified leads (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              data.isQualified
            </code>{' '}
            = true)
          </li>
          <li>
            Add a &ldquo;Formatter&rdquo; step to split{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.name</code>{' '}
            into first/last name if your platform needs it
          </li>
          <li>
            The webhook fires twice: once on opt-in (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">lead.created</code>
            ) and again after qualification (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              lead.qualified
            </code>
            ). Use the{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">event</code> field
            to filter.
          </li>
        </ul>
      </div>

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
