import Link from 'next/link';
import { Magnet, Check, ArrowRight, Zap, Target, Globe, Brain, CalendarClock, Webhook, Mic } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'AI-Guided Extraction',
    description:
      'Our system asks the right questions to extract YOUR unique expertise, not generic AI content.',
  },
  {
    icon: Mic,
    title: 'AI Content Pipeline',
    description:
      'Import transcripts from any recorder. AI extracts insights and writes LinkedIn posts in your voice.',
  },
  {
    icon: Brain,
    title: 'AI Brain',
    description:
      'Semantic knowledge base that gets smarter with every call. Search your expertise instantly.',
  },
  {
    icon: Globe,
    title: 'Hosted Landing Pages',
    description:
      'Beautiful opt-in pages, thank you pages, and hosted content pages — no website needed.',
  },
  {
    icon: CalendarClock,
    title: 'Autopilot Publishing',
    description:
      'Weekly planner with drag-and-drop Kanban board. Auto-publish to LinkedIn on your schedule.',
  },
  {
    icon: Webhook,
    title: 'Universal Webhook',
    description:
      'Connect Grain, Fireflies, Fathom, Otter, or any recording tool via a single webhook URL.',
  },
];

const comparisonPoints = [
  { them: '$3,000+/month retainer', us: '$250/month, cancel anytime' },
  { them: 'Weeks to produce one lead magnet', us: 'Create unlimited lead magnets on demand' },
  { them: 'Generic copywriter output', us: 'YOUR expertise extracted, not ghostwritten' },
  { them: 'Manual lead follow-up', us: 'Automated comment-to-DM flow via LeadShark' },
  { them: 'Separate tools for pages & email', us: 'Landing pages, emails, and automation built in' },
  { them: 'Manual content creation from scratch', us: 'AI turns your calls into ready-to-post content' },
];

const pricing = [
  {
    name: 'Free',
    price: '$0',
    features: [
      '2 lead magnets/month',
      'Basic AI generation',
      'Hosted content pages',
      'Email sequences',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Unlimited',
    price: '$250',
    features: [
      'Unlimited lead magnets',
      'Premium AI (Opus 4.5)',
      'Custom landing pages',
      'AI Content Pipeline',
      'AI Brain (knowledge base)',
      'Autopilot publishing',
      'Universal webhook',
      'LeadShark integration',
      'LinkedIn scheduling',
      'Advanced analytics',
      'Priority support',
    ],
    cta: 'Go Unlimited',
    highlighted: true,
  },
];

export default function HomePage() {
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
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <div className="mb-6 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Lead magnets + AI-powered content from your own calls
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Create lead magnets your ICP{' '}
            <span className="text-primary">actually wants</span> — then fuel your LinkedIn
            with AI content
          </h1>
          <p className="mb-10 text-xl text-muted-foreground">
            Extract YOUR unique expertise, generate landing pages and email sequences,
            and turn your call recordings into a steady stream of LinkedIn posts — all in one platform.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="#how-it-works"
              className="flex items-center gap-2 rounded-lg border px-8 py-4 text-lg font-medium"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border bg-destructive/5 p-6">
              <h3 className="mb-4 text-xl font-semibold text-destructive">The Problem</h3>
              <p className="text-muted-foreground">
                Generic AI tools generate the same bland lead magnets everyone else has.
                Your calls are full of gold-mine content, but it stays trapped in recordings.
                You need separate tools for pages, emails, content, and delivery.
                It&apos;s a mess.
              </p>
            </div>
            <div className="rounded-xl border bg-primary/5 p-6">
              <h3 className="mb-4 text-xl font-semibold text-primary">Our Solution</h3>
              <p className="text-muted-foreground">
                MagnetLab extracts YOUR unique expertise for lead magnets, then turns your call
                recordings into LinkedIn posts automatically. One platform for lead magnets, content
                pipeline, and automated delivery. Zero duct tape.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — Lead Magnets */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">How It Works</h2>
          <p className="mb-12 text-center text-lg text-muted-foreground">
            Two engines, one platform
          </p>

          {/* Lead Magnet Steps */}
          <div className="mb-6">
            <div className="mb-8 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Lead Magnets
            </div>
          </div>
          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Tell us about your business',
                description:
                  'Share your expertise, credibility markers, and the pains your audience faces.',
              },
              {
                step: '2',
                title: 'Choose from 10 lead magnet concepts',
                description:
                  'We generate 10 tailored ideas across proven archetypes. Pick the one that excites you most.',
              },
              {
                step: '3',
                title: 'Answer archetype-specific questions',
                description:
                  'This is where the magic happens. We ask the right questions to extract your unique value.',
              },
              {
                step: '4',
                title: 'Launch your funnel',
                description:
                  'We generate your landing page, email sequence, LinkedIn posts, and connect it all to LeadShark for automated delivery.',
              },
            ].map((item, index) => (
              <div key={index} className="flex gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Content Pipeline Steps */}
          <div className="mb-6 mt-16">
            <div className="mb-8 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Content Pipeline
            </div>
          </div>
          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Import your call transcripts',
                description:
                  'Connect Grain, Fireflies, Fathom, or Otter via webhook — or paste and upload transcripts directly.',
              },
              {
                step: '2',
                title: 'AI extracts knowledge and post-worthy ideas',
                description:
                  'Your AI Brain learns from every call. It identifies key insights, frameworks, and stories worth sharing.',
              },
              {
                step: '3',
                title: 'Review, edit, and schedule in the Kanban board',
                description:
                  'Drag and drop posts through your weekly planner. Edit AI drafts or approve them as-is.',
              },
              {
                step: '4',
                title: 'Auto-publish to LinkedIn on your schedule',
                description:
                  'Set your posting slots, fill the buffer, and let Autopilot publish for you via LeadShark.',
              },
            ].map((item, index) => (
              <div key={index} className="flex gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Everything You Need</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div key={index} className="rounded-xl border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">MagnetLab vs Hiring an Agency</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-4 text-left font-medium">Agency</th>
                  <th className="bg-primary/10 px-6 py-4 text-left font-medium text-primary">
                    MagnetLab
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonPoints.map((point, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-6 py-4 text-muted-foreground">{point.them}</td>
                    <td className="bg-primary/5 px-6 py-4">
                      <span className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {point.us}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">Simple Pricing</h2>
          <p className="mb-12 text-center text-muted-foreground">
            Start free, upgrade when you&apos;re ready
          </p>
          <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
            {pricing.map((plan, index) => (
              <div
                key={index}
                className={`rounded-xl border p-6 ${
                  plan.highlighted ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'bg-card'
                }`}
              >
                {plan.highlighted && (
                  <div className="mb-4 text-sm font-medium text-primary">Full Platform</div>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`block w-full rounded-lg py-3 text-center font-medium ${
                    plan.highlighted
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="mb-6 text-3xl font-bold">Ready to turn your expertise into leads and content?</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            From lead magnets to AI-powered content from your own calls — everything you need to
            own LinkedIn.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground"
          >
            Get Started Free
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
              <a href="mailto:support@magnetlab.app" className="hover:text-foreground">
                Support
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 MagnetLab. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
