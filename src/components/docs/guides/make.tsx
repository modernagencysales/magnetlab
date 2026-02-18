'use client';

import Link from 'next/link';

export default function MakeGuide() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Connect with Make</h1>
      <p className="text-muted-foreground mb-8">
        Connect MagnetLab to your email platform using Make (formerly Integromat). More flexible than
        Zapier for complex automations.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">What You&apos;ll Need</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>A Make account (free tier works)</li>
        <li>Your email platform module available in Make</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step-by-Step</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          <span>
            In Make, click <strong>Create a new scenario</strong>
          </span>
        </li>
        <li>
          <span>
            Click the <strong>+</strong> and search for <strong>&ldquo;Webhooks&rdquo;</strong>
          </span>
        </li>
        <li>
          <span>
            Choose <strong>&ldquo;Custom webhook&rdquo;</strong>
          </span>
        </li>
        <li>
          <span>
            Click <strong>Add</strong> to create a new webhook &mdash; give it a name
          </span>
        </li>
        <li>
          <span>
            Make gives you a URL &mdash; <strong>copy it</strong>
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
          <span>
            Click <strong>Test</strong> in MagnetLab
          </span>
        </li>
        <li>
          <span>
            Back in Make, click <strong>Run once</strong> &rarr; <strong>OK</strong> &mdash; the test
            data appears
          </span>
        </li>
        <li>
          <span>
            Add your email platform module (click <strong>+</strong> after the webhook)
          </span>
        </li>
        <li>
          <span>
            Map the fields:
          </span>
          <ul className="list-disc list-inside space-y-2 text-sm mt-2 ml-6">
            <li>
              Email:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.email</code>
            </li>
            <li>
              Name:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.name</code>
            </li>
          </ul>
        </li>
        <li>
          <span>
            Click <strong>Run once</strong> to test the full flow
          </span>
        </li>
        <li>
          <span>
            Toggle the scenario <strong>ON</strong> (bottom-left switch)
          </span>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Tips</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            Use a Router module to send qualified leads to one list and unqualified to another
          </li>
          <li>
            Make shows the full data structure after the first webhook &mdash; click fields to map
            them
          </li>
          <li>
            Set the scenario to run &ldquo;Immediately&rdquo; (not on a schedule) for real-time
            processing
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
