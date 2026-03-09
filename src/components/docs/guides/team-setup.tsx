'use client';

import Link from 'next/link';

export default function TeamSetup() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Setting Up Your Team</h1>
      <p className="text-muted-foreground mb-8">
        Create a team, add profiles for each person posting on LinkedIn, and configure their voice
        settings.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Create a Team</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to the <strong>Team</strong> page from the sidebar
        </li>
        <li>
          Click <strong>+ Create Team</strong> in the top-right
        </li>
        <li>
          Fill in the form:
          <ul className="list-disc list-inside space-y-2 text-sm ml-6 mt-2">
            <li>
              <strong>Team Name</strong> (required) &mdash; e.g., &ldquo;Modern Agency Sales&rdquo;
            </li>
            <li>
              <strong>Industry</strong> (optional) &mdash; e.g., &ldquo;B2B SaaS&rdquo;
            </li>
            <li>
              <strong>Shared Goal</strong> (optional) &mdash; e.g., &ldquo;Build thought
              leadership&rdquo;
            </li>
          </ul>
        </li>
        <li>
          Click <strong>Create Team</strong>
        </li>
      </ol>
      <p className="text-sm mt-4">
        Your team appears in the &ldquo;Your Teams&rdquo; section. Click <strong>Enter</strong> to
        switch into it, or <strong>Manage</strong> to configure profiles.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Add Team Profiles</h2>
      <p className="text-sm mb-4">
        Each person posting on LinkedIn needs their own profile. This controls their voice, posting
        schedule, and LinkedIn connection.
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          On the Team page, click <strong>Manage</strong> on your team
        </li>
        <li>
          Under <strong>Team Profiles</strong>, click <strong>+ Add Profile</strong>
        </li>
        <li>
          Fill in the <strong>Details</strong> tab:
          <ul className="list-disc list-inside space-y-2 text-sm ml-6 mt-2">
            <li>
              <strong>Full Name</strong> (required)
            </li>
            <li>
              <strong>Email</strong> &mdash; for notifications and invites
            </li>
            <li>
              <strong>Title</strong> &mdash; e.g., &ldquo;CEO&rdquo;, &ldquo;Head of Sales&rdquo;
            </li>
            <li>
              <strong>LinkedIn URL</strong> &mdash; their profile link
            </li>
            <li>
              <strong>Bio</strong> &mdash; background, expertise, what they&apos;re known for
            </li>
            <li>
              <strong>Expertise Areas</strong> &mdash; comma-separated, e.g., &ldquo;Sales,
              Marketing, AI&rdquo;
            </li>
          </ul>
        </li>
        <li>
          Switch to the <strong>Voice Profile</strong> tab (see{' '}
          <Link
            href="/docs/team-linkedin-voices"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Voice Profiles
          </Link>{' '}
          for details)
        </li>
        <li>
          Click <strong>Add Member</strong>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Invite Team Members</h2>
      <p className="text-sm mb-4">
        Team members can log in to MagnetLab and access team resources. They can edit their own
        profile and publish from their account.
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to <strong>Settings</strong> &rarr; <strong>Account</strong>
        </li>
        <li>
          Scroll to the <strong>Team Members</strong> section
        </li>
        <li>Enter the team member&apos;s email and click <strong>+ Invite</strong></li>
        <li>
          They&apos;ll appear as <strong>Pending</strong> until they accept
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Switch Between Teams</h2>
      <p className="text-sm mb-4">
        If you have multiple teams (or a personal account + team), you can switch contexts.
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to <strong>/team-select</strong> (or click your team name in the sidebar)
        </li>
        <li>Click the team or personal account you want to use</li>
        <li>All data in MagnetLab is now scoped to that team</li>
      </ol>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm font-medium mb-1">Roles</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Owner</strong> &mdash; full access: manage members, edit all profiles, broadcast,
            configure settings
          </li>
          <li>
            <strong>Member</strong> &mdash; can view team content, edit their own profile, publish
            from their own account
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">What&apos;s Next?</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4 space-y-2">
        <p className="text-sm">
          Connect each team member&apos;s LinkedIn account and set up their posting schedule.
        </p>
        <p className="text-sm">
          <Link
            href="/docs/team-linkedin-voices"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            LinkedIn Connections &amp; Voice Profiles &rarr;
          </Link>
        </p>
        <p className="text-sm">
          <Link
            href="/docs/team-posting-slots"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Managing Posting Slots &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
