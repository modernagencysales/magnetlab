'use client';

import Link from 'next/link';

export default function TeamPostingSlots() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Managing Posting Slots</h1>
      <p className="text-muted-foreground mb-8">
        Posting slots define when each team member&apos;s content goes live on LinkedIn. Set up a
        weekly schedule per person so the autopilot knows when to publish.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">What Are Posting Slots?</h2>
      <p className="text-sm mb-4">
        A posting slot is a time/day combination for publishing. For example: &ldquo;Tuesday at 8:30
        AM Eastern&rdquo; or &ldquo;Every day at 9:00 AM UTC.&rdquo; Each team member can have
        multiple slots.
      </p>
      <p className="text-sm mb-4">
        When you assign a buffer post to a day in the{' '}
        <Link
          href="/docs/team-command-center"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          Command Center
        </Link>
        , it automatically uses the posting slot time for that day. If no slot is set, it defaults to
        9:00 AM.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Set Up Posting Slots</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to the <strong>Content Pipeline</strong> from the sidebar
        </li>
        <li>
          Switch to the <strong>Autopilot</strong> tab
        </li>
        <li>
          Scroll to the <strong>Posting Schedule</strong> section
        </li>
        <li>
          Click <strong>+ Add Slot</strong>
        </li>
        <li>
          Configure the slot:
          <ul className="list-disc list-inside space-y-2 text-sm ml-6 mt-2">
            <li>
              <strong>Time</strong> &mdash; when to post (e.g., 09:00)
            </li>
            <li>
              <strong>Day</strong> &mdash; a specific day (Mon, Tue, etc.) or &ldquo;Any day&rdquo;
              for daily posting
            </li>
            <li>
              <strong>Timezone</strong> &mdash; UTC, Eastern, Central, Mountain, Pacific, or London
            </li>
          </ul>
        </li>
        <li>
          Click <strong>Add</strong>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Manage Existing Slots</h2>
      <p className="text-sm mb-4">
        Each slot appears as a card showing the time, day, and timezone. You can:
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Toggle Active/Paused</strong> &mdash; click the green &ldquo;Active&rdquo; or gray
          &ldquo;Paused&rdquo; badge to enable or disable a slot without deleting it
        </li>
        <li>
          <strong>Delete</strong> &mdash; click the trash icon to remove a slot permanently
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Assigning Posts to Slots</h2>
      <p className="text-sm mb-4">
        There are two ways to assign posts to time slots:
      </p>

      <h3 className="text-base font-semibold mt-6 mb-3">From the Command Center</h3>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>Click an empty cell in the weekly grid (for the team member + day you want)</li>
        <li>The Buffer Dock slides up showing available posts</li>
        <li>Click a post to assign it &mdash; it uses the posting slot time for that day</li>
      </ol>

      <h3 className="text-base font-semibold mt-6 mb-3">From a Broadcast</h3>
      <p className="text-sm mb-4">
        When you{' '}
        <Link
          href="/docs/team-broadcasting"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          broadcast a post
        </Link>
        , the system auto-assigns scheduled times based on each team member&apos;s posting slots and
        the stagger setting. You can reschedule any variation after by right-clicking it in the grid.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Removing Posts from Slots</h2>
      <p className="text-sm mb-4">
        To unschedule a post and send it back to the buffer:
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>Right-click the post in the Command Center grid</li>
        <li>
          Select <strong>Remove from Schedule</strong>
        </li>
        <li>The post moves back to the buffer with &ldquo;approved&rdquo; status</li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Recommended Setup</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            <strong>1 post per day per person</strong> &mdash; set one daily slot (e.g., &ldquo;Any
            day at 8:30 AM Eastern&rdquo;)
          </li>
          <li>
            <strong>Stagger times across team members</strong> &mdash; don&apos;t have everyone post
            at 9 AM. Spread it out (8 AM, 9:30 AM, 11 AM, etc.)
          </li>
          <li>
            <strong>Match the audience&apos;s timezone</strong> &mdash; post when your target
            audience is active (typically 7-9 AM or 11 AM-1 PM in their timezone)
          </li>
          <li>
            <strong>Weekdays only</strong> &mdash; if your audience is B2B, set specific day slots
            for Mon-Fri instead of &ldquo;Any day&rdquo;
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">What&apos;s Next?</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          Learn how to use the Command Center to manage your team&apos;s weekly schedule.{' '}
          <Link
            href="/docs/team-command-center"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Using the Command Center &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
