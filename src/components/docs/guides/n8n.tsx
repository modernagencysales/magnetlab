'use client';

import Link from 'next/link';

export default function N8n() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Connect with n8n</h1>
      <p className="text-muted-foreground mb-8">
        Connect MagnetLab to your email platform using n8n &mdash; a self-hosted or cloud automation
        tool.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">What You&apos;ll Need</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>An n8n instance (cloud or self-hosted)</li>
        <li>Your email platform credentials</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step-by-Step</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          <span>Create a new workflow in n8n</span>
        </li>
        <li>
          <span>
            Add a <strong>Webhook</strong> trigger node
          </span>
        </li>
        <li>
          <span>
            Set HTTP Method to <strong>POST</strong>
          </span>
        </li>
        <li>
          <span>
            Copy the <strong>Production</strong> webhook URL
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
          <span>Paste the URL, name it, and save</span>
        </li>
        <li>
          <span>Activate the workflow (toggle in top-right)</span>
        </li>
        <li>
          <span>
            Click <strong>Test</strong> in MagnetLab to verify
          </span>
        </li>
        <li>
          <span>Add your email platform node (e.g., Mailchimp, ConvertKit)</span>
        </li>
        <li>
          <span>
            Map the fields using expressions:
          </span>
          <ul className="list-disc list-inside space-y-2 text-sm mt-2 ml-6">
            <li>
              Email:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {'{{ $json.data.email }}'}
              </code>
            </li>
            <li>
              Name:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {'{{ $json.data.name }}'}
              </code>
            </li>
            <li>
              Lead Magnet:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {'{{ $json.data.leadMagnetTitle }}'}
              </code>
            </li>
          </ul>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Tips</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            Use the <strong>IF</strong> node to route qualified vs. unqualified leads
          </li>
          <li>
            n8n shows the full payload in the input panel &mdash; click fields to auto-insert
            expressions
          </li>
          <li>
            For self-hosted: make sure your webhook URL is publicly accessible (use a tunnel like
            ngrok for testing)
          </li>
          <li>
            Use the <strong>production</strong> URL, not the test URL &mdash; test URLs only work
            while the workflow editor is open
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
