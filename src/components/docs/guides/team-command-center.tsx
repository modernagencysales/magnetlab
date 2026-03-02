'use client';

import Link from 'next/link';

export default function TeamCommandCenter() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Using the Command Center</h1>
      <p className="text-muted-foreground mb-8">
        The Team Command Center is a weekly calendar view that shows all team members&apos; LinkedIn
        posts in one place. Use it to schedule, review, and coordinate content across your team.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Getting There</h2>
      <p className="text-sm mb-4">
        Navigate to the <strong>Content Pipeline</strong> from the sidebar. If you&apos;re in a team
        context, you&apos;ll see the Team Command Center as the main view.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">The Weekly Grid</h2>
      <p className="text-sm mb-4">
        The grid shows <strong>team members as columns</strong> and{' '}
        <strong>days of the week as rows</strong> (Monday through Sunday). Each cell represents one
        team member&apos;s posting slot for that day.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Filled cells</strong> show a preview of the scheduled post (first ~80 characters)
        </li>
        <li>
          <strong>Empty cells</strong> are open slots &mdash; click them to assign a buffer post
        </li>
        <li>
          <strong>Click any post</strong> to open the Post Detail Modal for editing or polishing
        </li>
        <li>
          <strong>Right-click any post</strong> to open the context menu (broadcast, reschedule,
          remove)
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Week Navigation</h2>
      <p className="text-sm mb-4">
        Use the arrow buttons at the top to move between weeks:
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>&larr; / &rarr;</strong> &mdash; previous / next week
        </li>
        <li>
          <strong>This Week</strong> button &mdash; jump back to the current week
        </li>
      </ul>
      <p className="text-sm mt-2">
        The date range (e.g., &ldquo;Mar 3 - Mar 9, 2026&rdquo;) is shown next to the calendar
        icon.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Stats Bar</h2>
      <p className="text-sm mb-4">
        Below the navigation, three badges summarize the week at a glance:
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong className="text-green-600 dark:text-green-400">X scheduled</strong> &mdash; posts
          assigned to specific days/times this week
        </li>
        <li>
          <strong className="text-amber-600 dark:text-amber-400">X in buffer</strong> &mdash;
          approved posts waiting to be assigned to slots
        </li>
        <li>
          <strong>X/Y connected</strong> &mdash; how many team members have LinkedIn connected
          (green when all connected)
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">The Buffer Dock</h2>
      <p className="text-sm mb-4">
        Buffer posts are approved content waiting to be scheduled. When you click an empty cell in
        the grid:
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          The <strong>Buffer Dock</strong> slides up from the bottom of the screen
        </li>
        <li>
          It shows buffer posts available for that specific team member
        </li>
        <li>
          Click a buffer post card to assign it to that slot
        </li>
        <li>
          The post is scheduled at the team member&apos;s configured posting time for that day (or
          9:00 AM if no slot is set)
        </li>
        <li>
          The grid refreshes automatically
        </li>
      </ol>
      <p className="text-sm mt-4">
        If you see &ldquo;No buffer posts available for this profile,&rdquo; you need to create posts
        first in the Posts tab.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Post Detail Modal</h2>
      <p className="text-sm mb-4">
        Click any scheduled post in the grid to open the detail modal. From here you can:
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>View</strong> the full post content with a LinkedIn-style preview
        </li>
        <li>
          <strong>Edit</strong> the post text
        </li>
        <li>
          <strong>Polish</strong> &mdash; run AI to refine the writing (keeps the same voice)
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Right-Click Context Menu</h2>
      <p className="text-sm mb-4">
        Right-click any post in the grid to see these actions:
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>View Details</strong> &mdash; open the Post Detail Modal
        </li>
        <li>
          <strong>Broadcast to Team</strong> &mdash; create AI voice-adapted variations for other
          team members (see{' '}
          <Link
            href="/docs/team-broadcasting"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Broadcasting Posts
          </Link>
          )
        </li>
        <li>
          <strong>Reschedule</strong> &mdash; change the scheduled date/time
        </li>
        <li>
          <strong>Remove from Schedule</strong> &mdash; moves the post back to the buffer
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Collision Warnings</h2>
      <p className="text-sm mb-4">
        When two or more team members have posts about similar topics scheduled on the same day, an
        orange warning banner appears at the top of the grid. See{' '}
        <Link
          href="/docs/team-broadcasting"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          Broadcasting Posts
        </Link>{' '}
        for details on how collision detection works.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Tips</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            Plan a full week at once &mdash; use the grid to see gaps and fill them from the buffer
          </li>
          <li>
            Use{' '}
            <Link
              href="/docs/team-broadcasting"
              className="text-violet-600 dark:text-violet-400 hover:underline"
            >
              Broadcast
            </Link>{' '}
            to quickly generate content for all team members from one strong post
          </li>
          <li>
            Check the collision warning before the week starts to avoid topic overlap
          </li>
          <li>
            Make sure all team members show as &ldquo;Connected&rdquo; in the stats bar before
            scheduling
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">What&apos;s Next?</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          Learn how to broadcast one post across your entire team with AI voice adaptation.{' '}
          <Link
            href="/docs/team-broadcasting"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Broadcasting Posts to Your Team &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
