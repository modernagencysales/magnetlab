import { Metadata } from 'next';
import {
  BookOpen,
  FileText,
  Zap,
  Calendar,
  Brain,
  Lightbulb,
  Mic,
  Upload,
  Webhook,
  Clock,
  Search,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Content Pipeline Docs - MagnetLab',
  description: 'Documentation for the MagnetLab Content Pipeline',
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-100">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    POST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    PATCH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <div className="flex items-start gap-3">
      <span
        className={`shrink-0 rounded border px-2 py-0.5 font-mono text-xs font-bold ${methodColors[method] || ''}`}
      >
        {method}
      </span>
      <div className="min-w-0">
        <code className="break-all font-mono text-sm text-zinc-200">{path}</code>
        <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

function SectionIcon({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
      <Icon className="h-4 w-4 text-primary" />
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Page Header */}
      <div className="mb-10">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Content Pipeline Documentation</h1>
        </div>
        <p className="text-muted-foreground">
          Learn how to use the Content Pipeline to turn your conversations into
          LinkedIn content. Import transcripts, build an AI knowledge base, extract
          ideas, and publish posts on autopilot.
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="mb-12 rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          On this page
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="#getting-started" className="text-primary hover:underline">
              1. Getting Started
            </a>
          </li>
          <li>
            <a href="#importing-transcripts" className="text-primary hover:underline">
              2. Importing Transcripts
            </a>
          </li>
          <li>
            <a href="#ai-brain" className="text-primary hover:underline">
              3. AI Brain (Knowledge Base)
            </a>
          </li>
          <li>
            <a href="#content-ideas" className="text-primary hover:underline">
              4. Content Ideas
            </a>
          </li>
          <li>
            <a href="#pipeline-publishing" className="text-primary hover:underline">
              5. Pipeline &amp; Publishing
            </a>
          </li>
          <li>
            <a href="#webhook-reference" className="text-primary hover:underline">
              6. Webhook Reference
            </a>
          </li>
        </ul>
      </nav>

      {/* 1. Getting Started */}
      <section id="getting-started" className="mb-14">
        <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
          <SectionIcon icon={Sparkles} />
          <h2 className="text-xl font-semibold">1. Getting Started</h2>
        </div>
        <p className="mb-4 text-zinc-300">
          The Content Pipeline transforms your real conversations into polished LinkedIn
          posts. The flow works in five stages:
        </p>
        <div className="mb-6 overflow-x-auto rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-blue-400">
              <Mic className="h-3.5 w-3.5" />
              Transcripts
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-purple-400">
              <Brain className="h-3.5 w-3.5" />
              Knowledge
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-amber-400">
              <Lightbulb className="h-3.5 w-3.5" />
              Ideas
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-400">
              <FileText className="h-3.5 w-3.5" />
              Posts
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-1.5 text-rose-400">
              <Calendar className="h-3.5 w-3.5" />
              Publish
            </span>
          </div>
        </div>
        <ol className="list-inside list-decimal space-y-2 text-zinc-300">
          <li>
            <strong>Import transcripts</strong> from calls, meetings, or coaching sessions
            -- paste text, upload a file, or connect a recording tool via webhook.
          </li>
          <li>
            <strong>AI classifies and extracts knowledge</strong> -- insights, questions,
            market intel, and client stories are stored in your personal AI Brain with
            vector embeddings for semantic search.
          </li>
          <li>
            <strong>Content ideas are surfaced</strong> -- the AI identifies post-worthy
            moments and scores them by relevance and content pillar.
          </li>
          <li>
            <strong>Posts are generated</strong> -- write posts from ideas manually, or
            let autopilot create and queue them automatically.
          </li>
          <li>
            <strong>Publish on schedule</strong> -- configure posting slots and posts
            publish to LinkedIn via LeadShark at the times you choose.
          </li>
        </ol>
      </section>

      {/* 2. Importing Transcripts */}
      <section id="importing-transcripts" className="mb-14">
        <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
          <SectionIcon icon={Upload} />
          <h2 className="text-xl font-semibold">2. Importing Transcripts</h2>
        </div>
        <p className="mb-6 text-zinc-300">
          There are three ways to get transcripts into the pipeline. All methods trigger
          AI processing automatically once the transcript is saved.
        </p>

        {/* Paste / Upload */}
        <h3 className="mb-3 text-lg font-medium">Paste or Upload via Dashboard</h3>
        <p className="mb-4 text-zinc-400">
          Navigate to <strong>Content &rarr; Transcripts</strong> tab and click{' '}
          <strong>Add Transcript</strong>. You can either paste the full transcript text
          or upload a file.
        </p>
        <div className="mb-6 rounded-xl border bg-card p-5">
          <h4 className="mb-2 text-sm font-semibold text-zinc-300">Paste</h4>
          <p className="mb-4 text-sm text-zinc-400">
            Paste the raw transcript text (minimum 100 characters). Optionally provide a
            title. The transcript is saved with source <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">paste</code>.
          </p>
          <h4 className="mb-2 text-sm font-semibold text-zinc-300">File Upload</h4>
          <p className="text-sm text-zinc-400">
            Upload <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">.txt</code>,{' '}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">.vtt</code>, or{' '}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">.srt</code> files
            (max 10 MB). VTT and SRT files are automatically parsed -- timestamps and
            cue markers are stripped, leaving clean text. The transcript is saved with
            source <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">upload</code>.
          </p>
        </div>

        {/* Universal Webhook */}
        <h3 className="mb-3 text-lg font-medium">Universal Webhook</h3>
        <p className="mb-4 text-zinc-400">
          Connect any recording tool to MagnetLab by sending transcripts to the
          universal webhook endpoint. This works with Zapier, Make, or direct HTTP
          calls.
        </p>
        <div className="mb-4">
          <Endpoint
            method="POST"
            path="/api/webhooks/transcript?secret=<TRANSCRIPT_WEBHOOK_SECRET>&user_id=<your_user_id>"
            description="Ingest a transcript from any external source."
          />
        </div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-300">JSON Payload</h4>
        <CodeBlock>{`{
  "source": "fathom",
  "recording_id": "rec_abc123",
  "title": "Discovery Call with Acme Corp",
  "date": "2026-02-09T14:30:00Z",
  "duration_minutes": 45,
  "participants": ["Tim", "Sarah (Acme)"],
  "transcript": "Tim: Thanks for joining today...\\nSarah: Happy to be here..."
}`}</CodeBlock>

        <h4 className="mt-4 mb-2 text-sm font-semibold text-zinc-300">Fields</h4>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="py-2 pr-4 text-zinc-300">Field</th>
                <th className="py-2 pr-4 text-zinc-300">Required</th>
                <th className="py-2 text-zinc-300">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">recording_id</td>
                <td className="py-2 pr-4 text-emerald-400">Yes</td>
                <td className="py-2">Unique identifier from the recording tool</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">transcript</td>
                <td className="py-2 pr-4 text-emerald-400">Yes</td>
                <td className="py-2">
                  Full transcript text (plain text, speaker labels optional)
                </td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">source</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">
                  Tool name (e.g., &quot;fathom&quot;, &quot;otter&quot;, &quot;tldv&quot;). Defaults to &quot;other&quot;
                </td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">title</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">Human-readable title for the transcript</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">date</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">ISO 8601 date/time of the recording</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">duration_minutes</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">Call duration in minutes</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">participants</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">Array of participant names</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h4 className="mb-1 text-sm font-semibold text-amber-400">Deduplication</h4>
          <p className="text-sm text-zinc-400">
            Transcripts are deduplicated by <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">source</code> +{' '}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">recording_id</code>.
            Sending the same combination again will return the existing transcript ID
            without reprocessing.
          </p>
        </div>

        {/* Supported Tools */}
        <h3 className="mb-3 text-lg font-medium">Supported Recording Tools</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <h4 className="mb-1 text-sm font-semibold text-zinc-200">Native Integrations</h4>
            <p className="text-sm text-zinc-400">
              Grain and Fireflies have dedicated webhook endpoints with built-in payload
              parsing. Connect them directly from your recording tool&apos;s settings.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <h4 className="mb-1 text-sm font-semibold text-zinc-200">Via Universal Webhook</h4>
            <p className="text-sm text-zinc-400">
              Fathom, Otter.ai, tl;dv, Read.ai, Tactiq, Krisp, and any other tool that
              can export transcripts. Use Zapier or Make to send to the universal
              webhook.
            </p>
          </div>
        </div>
      </section>

      {/* 3. AI Brain */}
      <section id="ai-brain" className="mb-14">
        <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
          <SectionIcon icon={Brain} />
          <h2 className="text-xl font-semibold">3. AI Brain (Knowledge Base)</h2>
        </div>
        <p className="mb-4 text-zinc-300">
          When a transcript is processed, the AI automatically classifies it and
          extracts structured knowledge entries. These entries form your personal
          knowledge base -- an AI Brain that powers content generation and lead magnet
          ideation.
        </p>

        <h3 className="mb-3 text-lg font-medium">Transcript Classification</h3>
        <p className="mb-3 text-zinc-400">
          Each transcript is classified into one of five types:
        </p>
        <div className="mb-6 flex flex-wrap gap-2">
          {['coaching', 'discovery', 'internal', 'interview', 'sales_call'].map(
            (type) => (
              <span
                key={type}
                className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300"
              >
                {type}
              </span>
            )
          )}
        </div>

        <h3 className="mb-3 text-lg font-medium">Knowledge Extraction</h3>
        <p className="mb-3 text-zinc-400">
          The AI extracts individual knowledge entries from each transcript. Every entry
          includes:
        </p>
        <ul className="mb-6 list-inside list-disc space-y-1.5 text-zinc-400">
          <li>
            <strong className="text-zinc-300">Speaker attribution</strong> -- who said it
          </li>
          <li>
            <strong className="text-zinc-300">Category</strong> -- insight, question,
            objection, success story, market intel, framework, etc.
          </li>
          <li>
            <strong className="text-zinc-300">Context</strong> -- surrounding discussion
            for richer understanding
          </li>
          <li>
            <strong className="text-zinc-300">Tags</strong> -- auto-generated topic tags
            for organization
          </li>
        </ul>

        <h3 className="mb-3 text-lg font-medium">Semantic Search</h3>
        <div className="mb-4 rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-zinc-200">
              pgvector Embeddings
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Every knowledge entry is embedded using OpenAI&apos;s{' '}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">text-embedding-3-small</code>{' '}
            model (1536 dimensions). When you search your knowledge base or generate
            content, the system uses cosine similarity to find the most relevant entries
            -- not just keyword matching. This means searching for &quot;client
            objections about pricing&quot; will surface entries about cost concerns,
            budget pushback, and ROI questions even if those exact words weren&apos;t
            used.
          </p>
        </div>
        <p className="text-sm text-zinc-500">
          The AI Brain is automatically used during content generation, post writing, and
          lead magnet ideation to inject real examples and insights from your
          conversations.
        </p>
      </section>

      {/* 4. Content Ideas */}
      <section id="content-ideas" className="mb-14">
        <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
          <SectionIcon icon={Lightbulb} />
          <h2 className="text-xl font-semibold">4. Content Ideas</h2>
        </div>
        <p className="mb-4 text-zinc-300">
          During transcript processing, the AI identifies moments that would make
          compelling LinkedIn posts. Each idea is scored and categorized into a content
          pillar.
        </p>

        <h3 className="mb-3 text-lg font-medium">Content Pillars</h3>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 text-sm font-semibold text-amber-400">
              Moments That Matter
            </div>
            <p className="text-sm text-zinc-400">
              Breakthrough moments, aha insights, and pivotal exchanges from your calls.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 text-sm font-semibold text-blue-400">
              Teaching &amp; Promotion
            </div>
            <p className="text-sm text-zinc-400">
              Educational content, frameworks, and expertise you can teach your audience.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 text-sm font-semibold text-rose-400">
              Human &amp; Personal
            </div>
            <p className="text-sm text-zinc-400">
              Relatable stories, vulnerability, and behind-the-scenes moments.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 text-sm font-semibold text-emerald-400">
              Collaboration &amp; Social Proof
            </div>
            <p className="text-sm text-zinc-400">
              Client wins, partner shoutouts, and proof that your approach works.
            </p>
          </div>
        </div>

        <h3 className="mb-3 text-lg font-medium">Scoring</h3>
        <p className="mb-4 text-zinc-400">
          Each idea receives a relevance score and a composite score based on uniqueness,
          emotional resonance, and audience fit. Higher-scored ideas are prioritized in
          autopilot mode and appear first in the Ideas tab.
        </p>

        <h3 className="mb-3 text-lg font-medium">Writing Posts from Ideas</h3>
        <p className="text-zinc-400">
          From the <strong>Content &rarr; Ideas</strong> tab, click any idea to write it
          into a full post. The AI uses your writing style profile, knowledge base
          entries, and the original transcript context to generate a draft. You can also
          let autopilot handle this automatically.
        </p>
      </section>

      {/* 5. Pipeline & Publishing */}
      <section id="pipeline-publishing" className="mb-14">
        <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
          <SectionIcon icon={Calendar} />
          <h2 className="text-xl font-semibold">5. Pipeline &amp; Publishing</h2>
        </div>
        <p className="mb-4 text-zinc-300">
          The pipeline manages posts from creation through publishing. Use the Kanban
          board to track status and the scheduler to automate publishing.
        </p>

        <h3 className="mb-3 text-lg font-medium">Pipeline Stages</h3>
        <div className="mb-6 overflow-x-auto rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-lg bg-zinc-800 px-3 py-1.5 font-medium text-zinc-300">
              Ideas
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="rounded-lg bg-blue-500/10 px-3 py-1.5 font-medium text-blue-400">
              Written
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 font-medium text-amber-400">
              Review
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400">
              Scheduled
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="rounded-lg bg-rose-500/10 px-3 py-1.5 font-medium text-rose-400">
              Published
            </span>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-zinc-200">Posting Slots</span>
            </div>
            <p className="text-sm text-zinc-400">
              Configure your publishing schedule by setting time slots for each day of
              the week. Navigate to <strong>Content &rarr; Schedule</strong> to set up
              when posts should go out (e.g., Tuesday and Thursday at 8:30 AM).
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-zinc-200">Autopilot</span>
            </div>
            <p className="text-sm text-zinc-400">
              When autopilot is enabled, a nightly batch job (2 AM UTC) selects
              top-scored ideas, writes posts using your style profile and AI Brain
              context, and queues them in the buffer for review. Approved posts
              auto-publish to LinkedIn via LeadShark at your scheduled posting times.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-zinc-200">Weekly Planner</span>
            </div>
            <p className="text-sm text-zinc-400">
              The AI generates a week&apos;s content plan based on your knowledge base,
              past posts, and content pillar balance. Use the planner to preview and
              approve the week ahead, or adjust individual posts before they go live.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Webhook Reference */}
      <section id="webhook-reference" className="mb-14">
        <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
          <SectionIcon icon={Webhook} />
          <h2 className="text-xl font-semibold">6. API &amp; Webhook Reference</h2>
        </div>
        <p className="mb-6 text-zinc-300">
          All Content Pipeline API endpoints. Dashboard endpoints require an
          authenticated session. Webhook endpoints use secret-based auth via URL
          parameters.
        </p>

        {/* Webhooks */}
        <h3 className="mb-4 text-lg font-medium">Webhook Endpoints</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="POST"
            path="/api/webhooks/transcript"
            description="Universal transcript webhook. Auth via ?secret= and ?user_id= query params. Accepts any recording tool."
          />
          <Endpoint
            method="POST"
            path="/api/webhooks/grain"
            description="Native Grain webhook. Auth via ?secret= query param. Parses Grain-specific payload format."
          />
          <Endpoint
            method="POST"
            path="/api/webhooks/fireflies"
            description="Native Fireflies webhook. Auth via ?secret= query param. Parses Fireflies-specific payload format."
          />
        </div>

        {/* Transcripts */}
        <h3 className="mb-4 text-lg font-medium">Transcripts</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/transcripts"
            description="List all transcripts for the authenticated user (most recent first, limit 50)."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/transcripts"
            description="Paste a transcript. Body: { transcript, title? }. Min 100 characters."
          />
          <Endpoint
            method="DELETE"
            path="/api/content-pipeline/transcripts?id=<transcript_id>"
            description="Delete a transcript and all associated knowledge entries and ideas (CASCADE)."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/transcripts/upload"
            description="Upload a .txt, .vtt, or .srt file (max 10 MB). Send as multipart/form-data with file and optional title."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/transcripts/webhook-config"
            description="Get the user's webhook URL and secret for configuring external tools."
          />
        </div>

        {/* Knowledge */}
        <h3 className="mb-4 text-lg font-medium">Knowledge Base</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/knowledge"
            description="Search and browse knowledge entries. Supports semantic search via ?q= query param."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/knowledge/clusters"
            description="Get knowledge entries grouped by topic clusters."
          />
        </div>

        {/* Ideas */}
        <h3 className="mb-4 text-lg font-medium">Content Ideas</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/ideas"
            description="List content ideas with optional filters (?status=, ?pillar=)."
          />
          <Endpoint
            method="PATCH"
            path="/api/content-pipeline/ideas/[id]"
            description="Update an idea (status, notes, etc.)."
          />
          <Endpoint
            method="DELETE"
            path="/api/content-pipeline/ideas/[id]"
            description="Delete a content idea."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/ideas/[id]/write"
            description="Write a post from an idea. AI generates a draft using your style profile and knowledge base."
          />
        </div>

        {/* Posts */}
        <h3 className="mb-4 text-lg font-medium">Posts</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/posts"
            description="List pipeline posts with optional status filter."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/posts"
            description="Create a new post manually."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/posts/[id]"
            description="Get a single post by ID."
          />
          <Endpoint
            method="PATCH"
            path="/api/content-pipeline/posts/[id]"
            description="Update post content, status, or scheduled time."
          />
          <Endpoint
            method="DELETE"
            path="/api/content-pipeline/posts/[id]"
            description="Delete a post."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/posts/[id]/polish"
            description="AI-polish a post for clarity, hook strength, and engagement."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/posts/[id]/publish"
            description="Publish a post to LinkedIn immediately via LeadShark."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/posts/schedule"
            description="Schedule a post for a specific posting slot."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/posts/by-date-range"
            description="Get posts within a date range (?start=&end=). Used by the calendar view."
          />
        </div>

        {/* Quick Write */}
        <h3 className="mb-4 text-lg font-medium">Quick Write</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="POST"
            path="/api/content-pipeline/quick-write"
            description="Generate a post from a freeform prompt without needing a transcript or idea."
          />
        </div>

        {/* Schedule */}
        <h3 className="mb-4 text-lg font-medium">Schedule &amp; Autopilot</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/schedule/slots"
            description="List all posting slots for the user."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/schedule/slots"
            description="Create a new posting slot (day of week + time)."
          />
          <Endpoint
            method="PATCH"
            path="/api/content-pipeline/schedule/slots/[id]"
            description="Update a posting slot."
          />
          <Endpoint
            method="DELETE"
            path="/api/content-pipeline/schedule/slots/[id]"
            description="Delete a posting slot."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/schedule/autopilot"
            description="Trigger an autopilot run manually (normally runs nightly at 2 AM UTC)."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/schedule/autopilot"
            description="Get autopilot status and configuration."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/schedule/buffer"
            description="List posts in the autopilot buffer awaiting approval."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/schedule/buffer"
            description="Approve or reject a buffered post."
          />
        </div>

        {/* Weekly Planner */}
        <h3 className="mb-4 text-lg font-medium">Weekly Planner</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/planner"
            description="Get the current weekly content plan."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/planner/generate"
            description="Generate a new weekly content plan using AI."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/planner/approve"
            description="Approve the weekly plan and convert planned posts into pipeline posts."
          />
          <Endpoint
            method="PATCH"
            path="/api/content-pipeline/planner/[id]"
            description="Update an individual planned post before approval."
          />
        </div>

        {/* Styles & Templates */}
        <h3 className="mb-4 text-lg font-medium">Styles &amp; Templates</h3>
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/styles"
            description="List writing style profiles."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/styles/extract"
            description="Extract a writing style from sample posts."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/styles/[id]"
            description="Get a specific writing style profile."
          />
          <Endpoint
            method="GET"
            path="/api/content-pipeline/templates"
            description="List post templates."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/templates"
            description="Create a new post template."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/templates/match"
            description="Find templates matching a given idea or topic using semantic similarity."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/templates/seed"
            description="Seed the template library with starter templates."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/templates/bulk-import"
            description="Import multiple templates at once."
          />
        </div>

        {/* Other */}
        <h3 className="mb-4 text-lg font-medium">Other</h3>
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <Endpoint
            method="GET"
            path="/api/content-pipeline/business-context"
            description="Get the user's business context used for content generation."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/scraper"
            description="Scrape a LinkedIn post URL for content analysis."
          />
          <Endpoint
            method="POST"
            path="/api/content-pipeline/scraper/extract-template"
            description="Extract a reusable template from a scraped post."
          />
        </div>
      </section>

      {/* Footer */}
      <div className="rounded-xl border bg-card p-5 text-center">
        <p className="text-sm text-zinc-400">
          Questions? Reach out via the feedback widget in the bottom-right corner or
          email support. For webhook setup help, check{' '}
          <strong>Settings &rarr; Integrations</strong> for your webhook URLs and
          secrets.
        </p>
      </div>
    </div>
  );
}
