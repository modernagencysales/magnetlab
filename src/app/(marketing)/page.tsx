import Link from 'next/link';
import { Magnet, Check, ArrowRight, Zap, Target, FileText, Calendar } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'AI-Guided Extraction',
    description:
      'Our system asks the right questions to extract YOUR unique expertise, not generic AI content.',
  },
  {
    icon: Zap,
    title: '10 Proven Archetypes',
    description:
      'Choose from 10 battle-tested lead magnet formats that convert, each with specific extraction questions.',
  },
  {
    icon: FileText,
    title: 'Anti-Cliche Posts',
    description:
      'Our post writer avoids AI cliches and writes in your voice, with 3 variations to choose from.',
  },
  {
    icon: Calendar,
    title: 'LinkedIn Automation',
    description:
      'Schedule posts and auto-DM commenters. Your lead magnet works while you sleep.',
  },
];

const comparisonPoints = [
  { them: 'Generate generic content instantly', us: 'Extract YOUR unique expertise' },
  { them: 'One-size-fits-all templates', us: '10 specialized archetypes' },
  { them: 'AI-sounding posts', us: 'Anti-cliche post writing' },
  { them: 'Manual follow-up', us: 'Automated comment-to-DM flow' },
  { them: 'Basic formatting', us: 'Rich Notion pages + thumbnails' },
];

const pricing = [
  {
    name: 'Free',
    price: '$0',
    features: ['2 lead magnets/month', 'Basic AI generation', 'Notion publishing'],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    features: [
      '15 lead magnets/month',
      '3 post variations',
      'LinkedIn scheduling',
      'Auto-DM automation',
      'Thumbnail generation',
    ],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Unlimited',
    price: '$149',
    features: [
      'Unlimited lead magnets',
      'Premium AI (Opus 4.5)',
      'Priority scheduling',
      'Advanced analytics',
      'Priority support',
    ],
    cta: 'Go Unlimited',
    highlighted: false,
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
            The anti-generic lead magnet generator
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Create lead magnets your ICP{' '}
            <span className="text-primary">actually wants</span>
          </h1>
          <p className="mb-10 text-xl text-muted-foreground">
            Other tools generate content for you. We extract YOUR unique expertise through
            guided questions, creating lead magnets that showcase your real value.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground"
            >
              Create Your First Lead Magnet
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
                Your audience can smell AI content from a mile away, and they&apos;re tired of it.
              </p>
            </div>
            <div className="rounded-xl border bg-primary/5 p-6">
              <h3 className="mb-4 text-xl font-semibold text-primary">Our Solution</h3>
              <p className="text-muted-foreground">
                MagnetLab extracts YOUR unique insights, stories, and expertise through
                archetype-specific questions. The result is content that only YOU could create.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Tell us about your business',
                description:
                  'Share your expertise, credibility markers, and the pains your audience faces. This takes 2 minutes.',
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
                title: 'Review and publish',
                description:
                  'Preview your content, choose from 3 LinkedIn post variations, and publish to Notion with one click.',
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
          <h2 className="mb-12 text-center text-3xl font-bold">Why MagnetLab?</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
          <h2 className="mb-12 text-center text-3xl font-bold">MagnetLab vs The Rest</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-4 text-left font-medium">Other Tools</th>
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
          <div className="grid gap-6 md:grid-cols-3">
            {pricing.map((plan, index) => (
              <div
                key={index}
                className={`rounded-xl border p-6 ${
                  plan.highlighted ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'bg-card'
                }`}
              >
                {plan.highlighted && (
                  <div className="mb-4 text-sm font-medium text-primary">Most Popular</div>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
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
          <h2 className="mb-6 text-3xl font-bold">Ready to create your first lead magnet?</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join creators who are building lead magnets that actually convert.
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
              <a href="mailto:support@magnetlab.io" className="hover:text-foreground">
                Support
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 MagnetLab. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
