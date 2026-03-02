'use client';

import Link from 'next/link';

export default function TeamLinkedInVoices() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">LinkedIn Connections &amp; Voice Profiles</h1>
      <p className="text-muted-foreground mb-8">
        Each team member needs a LinkedIn connection for auto-publishing and a voice profile so AI
        writes content that sounds like them.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Connecting LinkedIn</h2>
      <p className="text-sm mb-4">
        Each team member connects their own LinkedIn account via Unipile (our LinkedIn integration
        partner). This allows MagnetLab to publish posts directly to their LinkedIn profile.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-3">How to Connect</h3>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Open the{' '}
          <Link
            href="/docs/team-command-center"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Command Center
          </Link>
        </li>
        <li>
          If any team members are not connected, a yellow banner appears at the top:
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 mt-2 ml-6">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              X member(s) not connected to LinkedIn
            </p>
          </div>
        </li>
        <li>
          Click the <strong>Connect [Name]</strong> button for the team member
        </li>
        <li>
          You&apos;re redirected to Unipile&apos;s OAuth page &mdash; log in with that
          person&apos;s LinkedIn credentials
        </li>
        <li>
          Once connected, the banner disappears and the stats bar shows them as connected
        </li>
      </ol>

      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          <strong>Note:</strong> The LinkedIn connection is tied to the team profile, not the user
          account. This means team owners can connect LinkedIn for other members if they have the
          credentials.
        </p>
      </div>

      <h3 className="text-base font-semibold mt-6 mb-3">Connection Status</h3>
      <p className="text-sm mb-4">You can check connection status in two places:</p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Stats bar</strong> in the Command Center (e.g., &ldquo;3/5 connected&rdquo;)
        </li>
        <li>
          <strong>Broadcast Modal</strong> &mdash; each member shows a blue
          &ldquo;Connected&rdquo; or gray &ldquo;Not connected&rdquo; badge
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Voice Profiles</h2>
      <p className="text-sm mb-4">
        A voice profile tells the AI how each person writes on LinkedIn. It includes their tone,
        phrases they use, topics they cover, and their general style. Better voice profiles mean
        better AI-generated content that actually sounds like that person.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-3">Setting Up a Voice Profile</h3>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to the <strong>Team</strong> page &rarr; click <strong>Manage</strong> on your team
        </li>
        <li>
          Click <strong>Edit</strong> on the team member&apos;s profile card
        </li>
        <li>
          Switch to the <strong>Voice Profile</strong> tab
        </li>
        <li>
          Fill in as many fields as you can:
          <ul className="list-disc list-inside space-y-2 text-sm ml-6 mt-2">
            <li>
              <strong>First-Person Context</strong> &mdash; who they are in their own words, e.g.,
              &ldquo;I&apos;m a 15-year agency veteran who&apos;s scaled 3 businesses to
              $10M+&rdquo;
            </li>
            <li>
              <strong>Perspective Notes</strong> &mdash; where they speak from, e.g., &ldquo;Speaks
              from hands-on experience building sales teams&rdquo;
            </li>
            <li>
              <strong>Tone</strong> &mdash; e.g., &ldquo;Direct, warm, slightly irreverent&rdquo;
            </li>
            <li>
              <strong>Signature Phrases</strong> &mdash; phrases they naturally use (comma-separated)
            </li>
            <li>
              <strong>Banned Phrases</strong> &mdash; phrases to never use (comma-separated)
            </li>
            <li>
              <strong>Industry Jargon</strong> &mdash; domain-specific terms (comma-separated)
            </li>
            <li>
              <strong>Storytelling Style</strong> &mdash; e.g., &ldquo;Case studies from client
              work&rdquo; or &ldquo;Personal anecdotes&rdquo;
            </li>
          </ul>
        </li>
        <li>
          Click <strong>Save Changes</strong>
        </li>
      </ol>

      <h3 className="text-base font-semibold mt-6 mb-3">How Voice Profiles Are Used</h3>
      <p className="text-sm mb-4">
        Once configured, the voice profile is injected into every AI writing action for that person:
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>Post writing</strong> &mdash; new posts are drafted in their voice
        </li>
        <li>
          <strong>Post polishing</strong> &mdash; edits preserve their style
        </li>
        <li>
          <strong>Broadcasting</strong> &mdash; variations are rewritten to match each
          member&apos;s voice
        </li>
        <li>
          <strong>Email writing</strong> &mdash; newsletter emails use their tone
        </li>
        <li>
          <strong>Content briefs</strong> &mdash; briefing agents consider their expertise areas
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Voice Profile Self-Learning</h2>
      <p className="text-sm mb-4">
        Voice profiles automatically improve over time based on edits. Here&apos;s how:
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          When a team member edits an AI-generated post, the system captures the before/after diff
        </li>
        <li>
          AI classifies the edit pattern (e.g., &ldquo;shortened sentences&rdquo;, &ldquo;removed
          jargon&rdquo;, &ldquo;added personal anecdote&rdquo;)
        </li>
        <li>
          Every Sunday at 3:30 AM UTC, a background task aggregates these patterns
        </li>
        <li>
          Claude AI evolves the voice profile based on the accumulated edit history
        </li>
        <li>
          The updated voice profile is used for all future AI writing
        </li>
      </ol>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          <strong>Tip:</strong> The more a team member edits their AI-generated posts, the better the
          voice profile becomes. Encourage everyone to tweak posts rather than rewriting from scratch
          &mdash; the system learns from every edit.
        </p>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Quick Feedback</h2>
      <p className="text-sm mb-4">
        After editing a post, a small feedback toast may appear. You can quickly tag the edit with a
        reason like &ldquo;Too formal&rdquo;, &ldquo;Wrong tone&rdquo;, or &ldquo;Too generic.&rdquo;
        This helps the AI learn faster.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Tips for Strong Voice Profiles</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            <strong>Be specific in First-Person Context</strong> &mdash; &ldquo;15-year agency
            veteran&rdquo; is better than &ldquo;experienced marketer&rdquo;
          </li>
          <li>
            <strong>Add real signature phrases</strong> &mdash; the things this person actually says
            in meetings and conversations
          </li>
          <li>
            <strong>Use Banned Phrases</strong> &mdash; list corporate-speak or buzzwords this person
            would never use
          </li>
          <li>
            <strong>Don&apos;t skip Storytelling Style</strong> &mdash; this has a huge impact on
            how posts feel (e.g., &ldquo;Short war stories from the trenches&rdquo; vs. &ldquo;Data-driven
            case studies&rdquo;)
          </li>
          <li>
            <strong>Review after 2-3 weeks</strong> &mdash; check how the self-learning has evolved
            the profile and correct anything that drifted
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">What&apos;s Next?</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4 space-y-2">
        <p className="text-sm">
          <Link
            href="/docs/team-command-center"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Using the Command Center &rarr;
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
