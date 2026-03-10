import Link from 'next/link';
import {
  Magnet,
  ArrowRight,
  Shield,
  Eye,
  Trash2,
  Lock,
  Server,
  FileText,
  UserCheck,
  Database,
} from 'lucide-react';

// ─── Data Flow Steps ─────────────────────────────────────────────────────────

const dataFlowSteps = [
  {
    step: '1',
    title: 'Your call recorder sends us the text transcript',
    detail: 'Only the text. Never audio. Never video. Never screen recordings.',
  },
  {
    step: '2',
    title: 'AI extracts insights and content ideas',
    detail:
      'We send the transcript text to Claude (Anthropic) and OpenAI via their APIs. API usage is never used to train their models — this is contractually guaranteed by both providers.',
  },
  {
    step: '3',
    title: 'Extracted knowledge is stored in your private vault',
    detail:
      'Insights, frameworks, and content ideas are saved to your account. Row-level security means no other user — not even other MagnetLab customers — can access your data.',
  },
  {
    step: '4',
    title: 'You control everything from here',
    detail:
      'Edit, use, or delete. When you delete a transcript, all extracted data is permanently removed. No backups retained.',
  },
];

// ─── Commitments ─────────────────────────────────────────────────────────────

const commitments = [
  {
    icon: Shield,
    title: 'We never train on your data',
    description:
      'Your transcripts, insights, and content are never used to train any AI model — ours or anyone else\'s. Claude and OpenAI\'s API policies contractually prohibit using API data for training.',
  },
  {
    icon: UserCheck,
    title: 'Your data belongs to you',
    description:
      'You own everything you put into MagnetLab and everything it produces. We claim no rights to your content, insights, or intellectual property.',
  },
  {
    icon: Eye,
    title: 'No other customer sees your data',
    description:
      'Row-level security enforces strict data isolation at the database level. Your account is a vault — no other MagnetLab user can access it, period.',
  },
  {
    icon: Trash2,
    title: 'Delete means delete',
    description:
      'When you delete a transcript, all extracted knowledge, content ideas, and embeddings are permanently removed via cascading deletes. There is no "soft delete" or hidden retention.',
  },
  {
    icon: Lock,
    title: 'Encrypted in transit and at rest',
    description:
      'All data is encrypted via TLS in transit and AES-256 at rest through our infrastructure provider (Supabase on AWS). API calls to AI providers use encrypted connections.',
  },
  {
    icon: Server,
    title: 'AI providers delete after processing',
    description:
      'Anthropic (Claude) and OpenAI process your data via API and do not retain it after the response is returned. Zero data retention is the default for API customers.',
  },
];

// ─── Privacy Modes ───────────────────────────────────────────────────────────

const privacyModes = [
  {
    icon: FileText,
    title: 'Manual paste',
    description:
      'Don\'t connect anything. Copy and paste specific transcript sections you\'re comfortable sharing. Same as using any other AI tool.',
    tag: 'Maximum control',
  },
  {
    icon: Database,
    title: 'Auto-connect',
    description:
      'Connect Grain, Fireflies, Fathom, or any recorder via webhook. Transcripts flow in automatically and are processed within minutes.',
    tag: 'Maximum convenience',
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: 'Is the note-taker integration required?',
    a: 'No. The auto-connect feature is completely optional. You can paste transcripts manually, upload files, or skip the content pipeline entirely and just use MagnetLab for lead magnets and funnels.',
  },
  {
    q: 'Does OpenAI or Anthropic train on my data?',
    a: 'No. We use their APIs, not their consumer products. Both Anthropic and OpenAI contractually guarantee that API data is not used for model training. This is a key distinction from using ChatGPT or Claude.ai directly — the API has stronger privacy protections.',
  },
  {
    q: 'What about my call recording app — are they training on my data?',
    a: 'Most call recording platforms do use your data for model improvement, often with vague opt-out policies. MagnetLab only receives the text transcript — we never access the audio, and we give you actual value from data you\'re already sharing with those platforms.',
  },
  {
    q: 'Can I delete everything?',
    a: 'Yes. Delete any transcript and all associated knowledge entries, content ideas, and vector embeddings are permanently removed via cascading database deletes. You can also delete your entire account.',
  },
  {
    q: 'Who can see my data inside MagnetLab?',
    a: 'Only you (and your team members, if you\'ve set up a team). Row-level security policies enforce this at the database level — it\'s not just application logic, it\'s a database-level guarantee.',
  },
  {
    q: 'What data do you send to AI providers?',
    a: 'The text of your transcript (truncated to 25,000 characters) is sent to Claude for knowledge extraction and content ideation. Short summaries of extracted insights are sent to OpenAI for generating search embeddings. The full audio or video recording is never sent anywhere.',
  },
  {
    q: 'Do you have SOC 2 certification?',
    a: 'Not yet. We\'re a growing platform and SOC 2 Type II is on our roadmap. In the meantime, we build on enterprise-grade infrastructure (Supabase on AWS, Vercel) that maintains their own SOC 2 and ISO certifications.',
  },
  {
    q: 'Can I use MagnetLab without any AI processing of my calls?',
    a: 'Absolutely. The content pipeline is one feature of many. You can create lead magnets, build funnels, capture leads, and run email sequences without ever connecting a call recorder or pasting a transcript.',
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Magnet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">MagnetLab</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            Trust & Privacy
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-5xl">
            Your data stays yours.
            <br />
            <span className="text-primary">Here&apos;s exactly how.</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            We turn your call transcripts into content gold. Here&apos;s a transparent look at what
            happens to your data at every step — no fine print, no surprises.
          </p>
        </div>
      </section>

      {/* Data Flow */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">What happens to your data</h2>
          <p className="mb-12 text-center text-muted-foreground">
            From transcript to content — every step, explained
          </p>

          {/* Visual flow */}
          <div className="space-y-1">
            {dataFlowSteps.map((item, index) => (
              <div key={index} className="relative">
                <div className="flex gap-6 rounded-xl border bg-card p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                {index < dataFlowSteps.length - 1 && (
                  <div className="ml-[2.75rem] h-4 w-px bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commitments */}
      <section className="py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">Our privacy commitments</h2>
          <p className="mb-12 text-center text-muted-foreground">
            Six promises we make to every customer
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {commitments.map((item, index) => (
              <div key={index} className="rounded-xl border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Modes */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">You choose your comfort level</h2>
          <p className="mb-12 text-center text-muted-foreground">
            Two ways to use the content pipeline — pick what works for you
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {privacyModes.map((mode, index) => (
              <div key={index} className="rounded-xl border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <mode.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {mode.tag}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold">{mode.title}</h3>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The reframe */}
      <section className="py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-8 md:p-12">
            <h2 className="mb-6 text-2xl font-bold md:text-3xl">
              A question worth asking
            </h2>
            <p className="mb-6 text-lg text-muted-foreground">
              Your call recorder already has your transcripts. Most of them train their models on
              your conversations and give you nothing in return except a searchable archive.
            </p>
            <p className="mb-6 text-lg text-muted-foreground">
              MagnetLab is the opposite — we extract genuine value from that data (insights,
              content, posts in your voice) while giving you stronger privacy protections than the
              tools already sitting in your meetings.
            </p>
            <p className="text-lg font-medium">
              The question isn&apos;t whether AI touches your call data.
              <br />
              It&apos;s whether you&apos;re getting anything back for it.
            </p>
          </div>
        </div>
      </section>

      {/* AI Provider Policies */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">Our AI providers&apos; policies</h2>
          <p className="mb-12 text-center text-muted-foreground">
            We use API access, not consumer products — here&apos;s why that matters
          </p>
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4A574]/10 text-sm font-bold text-[#D4A574]">
                  A
                </div>
                <div>
                  <h3 className="font-semibold">Anthropic (Claude)</h3>
                  <p className="text-xs text-muted-foreground">Knowledge extraction & content generation</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  API data is not used to train models
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Data is not retained after processing the request
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  SOC 2 Type II certified
                </li>
              </ul>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#10A37F]/10 text-sm font-bold text-[#10A37F]">
                  O
                </div>
                <div>
                  <h3 className="font-semibold">OpenAI</h3>
                  <p className="text-xs text-muted-foreground">Search embeddings only (not full transcripts)</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  API data is not used for training by default
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Zero data retention available for API customers
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  SOC 2 Type II certified
                </li>
              </ul>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Important distinction: these protections apply to API access (what MagnetLab uses), not
              to consumer products like ChatGPT or Claude.ai where different policies apply.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Frequently asked questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-xl border bg-card p-6">
                <h3 className="mb-2 font-semibold">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="mb-6 text-3xl font-bold">Ready to get value from your calls?</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Start with lead magnets, add the content pipeline when you&apos;re ready.
            Your data stays yours every step of the way.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground"
          >
            Create Free Account
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Magnet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold">MagnetLab</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/trust" className="font-medium text-foreground">
                Trust
              </Link>
              <a href="mailto:support@magnetlab.app" className="hover:text-foreground">
                Support
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; 2026 MagnetLab. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
