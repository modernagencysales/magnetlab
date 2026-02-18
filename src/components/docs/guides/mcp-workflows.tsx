'use client';

import Link from 'next/link';

function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded bg-violet-500/10 px-4 py-3 text-sm my-3">{children}</div>
  );
}

function Result({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded bg-emerald-500/10 px-4 py-3 text-sm my-3">{children}</div>
  );
}

export default function McpWorkflows() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Example Workflows</h1>
      <p className="text-muted-foreground mb-8">
        Real examples of what you can do with the MagnetLab MCP server. Copy these prompts directly
        into Claude.
      </p>

      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          These workflows require the MCP server to be connected. If you haven&apos;t set it up
          yet, see the{' '}
          <Link
            href="/docs/mcp-setup"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            setup guide
          </Link>{' '}
          first.
        </p>
      </div>

      {/* Workflow 1: Landing Page in 60 Seconds */}
      <div className="rounded-lg border bg-card p-6 my-6">
        <h2 className="text-xl font-semibold mb-4">Landing Page in 60 Seconds</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Create and publish a landing page in two prompts.
        </p>

        <p className="text-sm font-medium">Prompt 1:</p>
        <Prompt>
          &ldquo;Create a lead magnet called &lsquo;The 5-Step SEO Audit Framework&rsquo; as a
          focused-toolkit&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude creates the lead magnet and returns its ID
        </p>

        <p className="text-sm font-medium">Prompt 2:</p>
        <Prompt>
          &ldquo;Create a dark-themed funnel page for that lead magnet with the slug
          &lsquo;seo-audit&rsquo; and publish it&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude creates the funnel, publishes it, returns the live URL
        </p>

        <Result>
          <strong>Result:</strong> A published landing page at{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            magnetlab.ai/p/your-username/seo-audit
          </code>
        </Result>
      </div>

      {/* Workflow 2: Full Funnel with Email Drip */}
      <div className="rounded-lg border bg-card p-6 my-6">
        <h2 className="text-xl font-semibold mb-4">Full Funnel with Email Drip</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Create a complete funnel with qualification and automated email follow-up.
        </p>

        <p className="text-sm font-medium">Prompt 1:</p>
        <Prompt>
          &ldquo;Create a lead magnet called &lsquo;Agency Growth Playbook&rsquo; as a
          single-system&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Creates the lead magnet
        </p>

        <p className="text-sm font-medium">Prompt 2:</p>
        <Prompt>
          &ldquo;Create a funnel for it, add a qualification question &lsquo;Are you a B2B agency
          owner?&rsquo; as single_choice with options Yes/No where Yes qualifies, then publish
          it&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Creates funnel with qualification, publishes
        </p>

        <p className="text-sm font-medium">Prompt 3:</p>
        <Prompt>
          &ldquo;Generate an email sequence for this lead magnet and activate it&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; AI writes 5 emails, activates the drip
        </p>

        <Result>
          <strong>Result:</strong> A complete funnel with qualification + automated email follow-up
        </Result>
      </div>

      {/* Workflow 3: Weekly Lead Review */}
      <div className="rounded-lg border bg-card p-6 my-6">
        <h2 className="text-xl font-semibold mb-4">Weekly Lead Review</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Review and export your recent leads.
        </p>

        <p className="text-sm font-medium">Prompt 1:</p>
        <Prompt>
          &ldquo;Show me all my leads from the last 7 days, grouped by funnel, with their
          qualification status&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude lists leads with details
        </p>

        <p className="text-sm font-medium">Prompt 2:</p>
        <Prompt>&ldquo;Export the qualified ones as CSV&rdquo;</Prompt>
        <p className="text-sm text-muted-foreground mb-4">&rarr; Returns CSV data</p>

        <Result>
          <strong>Result:</strong> A filtered CSV export of your qualified leads, ready for your CRM
        </Result>
      </div>

      {/* Workflow 4: Content from a Sales Call */}
      <div className="rounded-lg border bg-card p-6 my-6">
        <h2 className="text-xl font-semibold mb-4">Content from a Sales Call</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Turn a sales call transcript into a polished LinkedIn post.
        </p>

        <p className="text-sm font-medium">Prompt 1:</p>
        <Prompt>
          &ldquo;I just had a sales call. Here&apos;s the transcript: [paste transcript]. Process it
          &mdash; extract knowledge and content ideas.&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude processes transcript, extracts insights, generates ideas
        </p>

        <p className="text-sm font-medium">Prompt 2:</p>
        <Prompt>
          &ldquo;Write a LinkedIn post from the best idea, using my writing style&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude drafts a post matching your style
        </p>

        <p className="text-sm font-medium">Prompt 3:</p>
        <Prompt>
          &ldquo;Polish it and schedule it for next Tuesday at 9am&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude polishes and schedules
        </p>

        <Result>
          <strong>Result:</strong> A polished LinkedIn post scheduled for publishing, sourced from
          real sales call insights
        </Result>
      </div>

      {/* Workflow 5: Brand Kit Setup */}
      <div className="rounded-lg border bg-card p-6 my-6">
        <h2 className="text-xl font-semibold mb-4">Brand Kit Setup</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Bootstrap your brand context so all AI generation matches your voice.
        </p>

        <p className="text-sm font-medium">Prompt 1:</p>
        <Prompt>
          &ldquo;Extract my business context from this: [paste your about page, offer doc, or
          bio]&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude extracts your business description, target audience, pain points, etc.
        </p>

        <p className="text-sm font-medium">Prompt 2:</p>
        <Prompt>&ldquo;Update my brand kit with this context&rdquo;</Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Saves to your brand kit, used for all future AI generation
        </p>

        <Result>
          <strong>Result:</strong> Your brand context is stored and used for every lead magnet,
          funnel, and content piece Claude generates going forward
        </Result>
      </div>

      {/* Workflow 6: Content Autopilot */}
      <div className="rounded-lg border bg-card p-6 my-6">
        <h2 className="text-xl font-semibold mb-4">Content Autopilot Setup</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Set up automated content generation and publishing.
        </p>

        <p className="text-sm font-medium">Prompt 1:</p>
        <Prompt>
          &ldquo;Set up my posting schedule: Monday, Wednesday, and Friday at 8:30 AM&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude creates three posting slots
        </p>

        <p className="text-sm font-medium">Prompt 2:</p>
        <Prompt>
          &ldquo;Trigger the autopilot to generate 5 posts for my buffer&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; AI generates posts from your ideas and knowledge base
        </p>

        <p className="text-sm font-medium">Prompt 3:</p>
        <Prompt>
          &ldquo;Show me the buffer and polish any posts with a hook score below 7&rdquo;
        </Prompt>
        <p className="text-sm text-muted-foreground mb-4">
          &rarr; Claude reviews the buffer and polishes weak hooks
        </p>

        <Result>
          <strong>Result:</strong> A content buffer with polished posts, auto-publishing on your
          schedule
        </Result>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 my-6">
        <p className="text-sm">
          For a complete list of all 81 tools available, see the{' '}
          <Link
            href="/docs/mcp-tools"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            MCP Tool Reference &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
