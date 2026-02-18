'use client';

export default function EmailSequences() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Email Sequences</h1>
      <p className="text-muted-foreground mb-8">
        Set up an automated email drip sequence that sends to leads after they opt in. Built-in
        &mdash; no external email tool needed.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">How It Works</h2>
      <p className="text-sm mb-4">
        When someone opts into your landing page, MagnetLab can automatically send them a sequence
        of emails over the following days. No Zapier, no Mailchimp &mdash; it&apos;s built in.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Set Up a Sequence</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>Open your lead magnet in the Funnel Builder</li>
        <li>
          Go to the <strong>Email</strong> tab
        </li>
        <li>
          Click <strong>Generate Sequence</strong> &mdash; AI creates a 5-email welcome sequence
          based on your lead magnet content
        </li>
        <li>Review each email: subject line, body, send timing (days after opt-in)</li>
        <li>Edit any email to customize the copy</li>
        <li>
          Click <strong>Activate</strong> to turn it on
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">What Gets Sent</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Email 1</strong> (immediately): Welcome + link to your lead magnet content
        </li>
        <li>
          <strong>Email 2</strong> (Day 1): Key insight or quick win from your lead magnet
        </li>
        <li>
          <strong>Email 3</strong> (Day 3): Deeper dive into the topic
        </li>
        <li>
          <strong>Email 4</strong> (Day 5): Case study or social proof
        </li>
        <li>
          <strong>Email 5</strong> (Day 7): CTA &mdash; book a call, buy a product, etc.
        </li>
      </ul>
      <p className="text-sm mt-2 text-muted-foreground">
        Timing is configurable per email.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Custom Sending Domain (Optional)</h2>
      <p className="text-sm mb-4">
        By default, emails send from{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          sends.magnetlab.app
        </code>
        . To send from your own domain:
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to <strong>Settings</strong> &rarr; <strong>Resend</strong>
        </li>
        <li>
          Enter your Resend API key (get one at{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">resend.com</code>)
        </li>
        <li>Set up your domain in Resend</li>
        <li>Emails will now come from your domain</li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Tips</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>Keep emails short &mdash; 2-3 paragraphs max</li>
          <li>Each email should deliver value, not just sell</li>
          <li>
            The AI-generated sequence is a starting point &mdash; customize it for your voice
          </li>
          <li>You can deactivate the sequence at any time without losing the content</li>
        </ul>
      </div>
    </div>
  );
}
