'use client';

import Link from 'next/link';

export default function TeamBroadcasting() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Broadcasting Posts to Your Team</h1>
      <p className="text-muted-foreground mb-8">
        Take one strong LinkedIn post and let AI rewrite it in each team member&apos;s unique voice.
        Posts are automatically staggered across days so your team doesn&apos;t all post the same
        topic at once.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">How Broadcast Works</h2>
      <p className="text-sm mb-4">
        Broadcasting takes a source post and creates voice-adapted variations for selected team
        members. Each variation is rewritten by Claude AI using that person&apos;s{' '}
        <Link
          href="/docs/team-linkedin-voices"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          voice profile
        </Link>{' '}
        &mdash; their tone, signature phrases, storytelling style, and perspective.
      </p>
      <p className="text-sm mb-4">
        The result: the same core idea, but each version sounds like it was written by that person.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Start a Broadcast</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          In the{' '}
          <Link
            href="/docs/team-command-center"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Command Center
          </Link>
          , <strong>right-click</strong> any post in the grid
        </li>
        <li>
          Select <strong>Broadcast to Team</strong> from the context menu
        </li>
        <li>The Broadcast Modal opens showing a preview of the source post</li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Configure the Broadcast</h2>
      <p className="text-sm mb-4">The modal has three sections:</p>

      <h3 className="text-base font-semibold mt-6 mb-3">Source Post Preview</h3>
      <p className="text-sm mb-4">
        Shows the first few lines of the post being broadcast. This is the content that will be
        rewritten for each team member.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-3">Team Member Selection</h3>
      <p className="text-sm mb-4">
        A list of all team members with checkboxes. By default, all connected profiles are
        pre-selected (except the source author, who is marked as &ldquo;Source&rdquo; and can&apos;t
        be selected).
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>Each member shows their name, title, and LinkedIn connection status</li>
        <li>
          <strong className="text-blue-600 dark:text-blue-400">Connected</strong> members can have
          their posts auto-published
        </li>
        <li>
          <strong className="text-muted-foreground">Not connected</strong> members will get
          variations created, but posts must be published manually
        </li>
        <li>Click a member to toggle them on or off</li>
      </ul>

      <h3 className="text-base font-semibold mt-6 mb-3">Stagger Over</h3>
      <p className="text-sm mb-4">
        Choose how many days to spread the variations across (1-5 days). This prevents all team
        members from posting about the same topic on the same day.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>1 day</strong> &mdash; all variations post tomorrow
        </li>
        <li>
          <strong>2-3 days</strong> (recommended) &mdash; variations are evenly distributed starting
          tomorrow
        </li>
        <li>
          <strong>4-5 days</strong> &mdash; maximum spread for larger teams
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">After Clicking Broadcast</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>The system triggers a background task that generates each variation</li>
        <li>AI reads each team member&apos;s voice profile and rewrites the post in their style</li>
        <li>
          Each variation is created with status <strong>&ldquo;reviewing&rdquo;</strong> &mdash;
          they won&apos;t publish automatically until approved
        </li>
        <li>
          Variations are linked together by a broadcast group ID so you can track them as a set
        </li>
        <li>Scheduled times are auto-staggered across the number of days you selected</li>
        <li>
          The Command Center grid refreshes to show the new variations in their assigned slots
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Review Variations</h2>
      <p className="text-sm mb-4">
        After broadcasting, each variation appears in the grid with a &ldquo;reviewing&rdquo;
        status. You should review each one before it goes live:
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>Click the variation in the grid to open the Post Detail Modal</li>
        <li>Read through the content &mdash; make sure it sounds like that person</li>
        <li>Edit if needed &mdash; the AI does a good job but may need tweaks</li>
        <li>
          Use <strong>Polish</strong> for minor refinements without changing the voice
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Content Collision Detection</h2>
      <p className="text-sm mb-4">
        When two or more posts are scheduled on the same day, the system automatically runs AI
        collision detection (using Claude Haiku). If overlapping topics are found, an orange warning
        banner appears at the top of the Command Center.
      </p>
      <p className="text-sm mb-4">Each collision shows:</p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          A severity indicator:{' '}
          <span className="inline-block h-2 w-2 rounded-full bg-destructive" /> high,{' '}
          <span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> medium,{' '}
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" /> low
        </li>
        <li>
          A description of what overlaps (e.g., &ldquo;Both posts discuss cold email outreach
          strategies&rdquo;)
        </li>
        <li>
          A suggestion for how to fix it (e.g., &ldquo;Move one post to a different day&rdquo;)
        </li>
      </ul>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          <strong>Tip:</strong> Collision detection is designed to catch same-day topic overlap, not
          same-week overlap. Two posts about the same topic on different days is fine &mdash;
          that&apos;s what the stagger setting is for.
        </p>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Best Practices</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            Set a stagger of 2-3 days for a natural feel &mdash; your audience follows multiple team
            members
          </li>
          <li>
            Make sure each team member has a{' '}
            <Link
              href="/docs/team-linkedin-voices"
              className="text-violet-600 dark:text-violet-400 hover:underline"
            >
              voice profile
            </Link>{' '}
            configured before broadcasting &mdash; without one, the AI writes generically
          </li>
          <li>
            Always review variations before they go live &mdash; the AI is good but not perfect
          </li>
          <li>
            Watch the collision banner &mdash; if two people are posting about the same topic on the
            same day, reschedule one
          </li>
          <li>
            The source post should be strong before broadcasting &mdash; polish it first, then
            broadcast
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">What&apos;s Next?</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4 space-y-2">
        <p className="text-sm">
          <Link
            href="/docs/team-posting-slots"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Managing Posting Slots &rarr;
          </Link>
        </p>
        <p className="text-sm">
          <Link
            href="/docs/team-linkedin-voices"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            LinkedIn Connections &amp; Voice Profiles &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
