'use client';

import Link from 'next/link';

export default function CustomizeFunnel() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Customize Your Funnel</h1>
      <p className="text-muted-foreground mb-8">
        Fine-tune every aspect of your landing page &mdash; from colors and copy to qualification
        surveys and booking links.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Opt-in Page</h2>
      <p className="text-sm mb-4">
        The first thing visitors see. Edit in the <strong>Opt-in Page</strong> tab.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Headline</strong> &mdash; your main value proposition
        </li>
        <li>
          <strong>Subline</strong> &mdash; supporting detail
        </li>
        <li>
          <strong>Button text</strong> &mdash; the CTA (default: &ldquo;Get Free Access&rdquo;)
        </li>
        <li>
          <strong>Social proof</strong> &mdash; e.g., &ldquo;Join 500+ marketers&rdquo; (shown above
          or below the form)
        </li>
        <li>
          <strong>Slug</strong> &mdash; the URL path for your page
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Thank-You Page</h2>
      <p className="text-sm mb-4">
        What visitors see after opting in. Edit in the <strong>Thank-You Page</strong> tab.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Headline</strong> &mdash; confirmation message (default: &ldquo;Thanks! Check your
          email.&rdquo;)
        </li>
        <li>
          <strong>Subline</strong> &mdash; next steps
        </li>
        <li>
          <strong>Video URL</strong> &mdash; embed a VSL or welcome video
        </li>
        <li>
          <strong>Booking URL</strong> &mdash; embed a Cal.com calendar for scheduling calls
        </li>
        <li>
          <strong>Pass/fail messages</strong> &mdash; shown based on qualification results
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Qualification Questions</h2>
      <p className="text-sm mb-4">
        Add survey questions to qualify leads. Edit in the <strong>Qualification</strong> tab.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Question types</strong>: Yes/No, Text, Textarea, Multiple Choice
        </li>
        <li>Yes/No and Multiple Choice questions are scored &mdash; they determine if a lead is &ldquo;qualified&rdquo;</li>
        <li>Text and Textarea questions are informational only</li>
        <li>Qualified leads can be shown a booking calendar; unqualified leads see a different message</li>
        <li>Answers are included in webhook payloads</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Theme</h2>
      <p className="text-sm mb-4">
        Customize the look. Edit in the <strong>Theme</strong> tab.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>Dark or Light mode</li>
        <li>Primary color (hex) &mdash; buttons, accents</li>
        <li>Background style: Solid, Gradient, or Pattern</li>
        <li>Logo upload &mdash; shown at the top of the page</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Sections</h2>
      <p className="text-sm mb-4">
        Add content blocks above or below the form. Edit in the <strong>Sections</strong> tab.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>Testimonials</li>
        <li>Feature bullets / benefits</li>
        <li>Each section can be positioned above or below the opt-in form</li>
        <li>Drag to reorder</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Content Page</h2>
      <p className="text-sm mb-4">
        Your hosted lead magnet content. Edit in the <strong>Content</strong> tab.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>AI auto-polishes your content on first publish</li>
        <li>Visitors access it via a link on the thank-you page</li>
        <li>Supports multiple content block types</li>
      </ul>

      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          Need to set up the page first?{' '}
          <Link
            href="/docs/create-landing-page"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Create Your Landing Page &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
