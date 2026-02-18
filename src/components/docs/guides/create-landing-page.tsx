'use client';

import Link from 'next/link';

export default function CreateLandingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Create Your Landing Page</h1>
      <p className="text-muted-foreground mb-8">
        Create a landing page for your lead magnet in minutes using the Quick Page Creator.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Before You Start</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>You need a MagnetLab account</li>
        <li>
          Set your username in{' '}
          <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">
            Settings
          </Link>{' '}
          (used in your page URL:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            magnetlab.ai/p/your-username/your-slug
          </code>
          )
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Create Your Page</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Click <strong>Create</strong> in the sidebar, then <strong>Quick Page</strong>
        </li>
        <li>
          Enter your lead magnet title (e.g., &ldquo;Free SEO Audit Checklist&rdquo;)
        </li>
        <li>Add a short description of what it delivers (1-2 sentences)</li>
        <li>
          Click <strong>Generate</strong> &mdash; AI creates your opt-in page copy (headline, subline,
          button text)
        </li>
        <li>You&apos;re taken to the Funnel Builder to preview and customize</li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Customize (Optional)</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Headline &amp; Copy</strong>: Edit in the Opt-in Page tab
        </li>
        <li>
          <strong>Theme</strong>: Switch between dark/light in the Theme tab
        </li>
        <li>
          <strong>Colors</strong>: Pick a primary color to match your brand
        </li>
        <li>
          <strong>Logo</strong>: Upload your logo in the Theme tab
        </li>
        <li>
          <strong>Social Proof</strong>: Add a line like &ldquo;500+ downloads&rdquo; in the Opt-in
          Page tab
        </li>
        <li>
          <strong>Sections</strong>: Add testimonials or feature bullets in the Sections tab
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Publish</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Click <strong>Publish</strong> in the top-right of the Funnel Builder
        </li>
        <li>
          Your page is live at{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            magnetlab.ai/p/your-username/your-slug
          </code>
        </li>
        <li>Copy the URL and share it</li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">What&apos;s Next?</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          Connect your email list to receive leads in real-time.{' '}
          <Link
            href="/docs/connect-email-list"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Connect to Your Email List &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
