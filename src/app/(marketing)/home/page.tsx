import Link from 'next/link';
import { Magnet, Check, ArrowRight, Zap, Target, FileText, Calendar, Mail, Globe } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'AI-Guided Extraction',
    description:
      'Our system asks the right questions to extract YOUR unique expertise, not generic AI content.',
  },
  {
    icon: Globe,
    title: 'Hosted Landing Pages',
    description:
      'Beautiful opt-in pages, thank you pages, and hosted content pages — no website needed.',
  },
  {
    icon: Mail,
    title: 'Email Sequences',
    description:
      'Automated drip campaigns that nurture leads after they opt in. Set it and forget it.',
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
    title: 'LeadShark Integration',
    description:
      'Schedule posts, auto-DM commenters, and capture leads directly through LeadShark.',
  },
];

const comparisonPoints = [
  { them: '$3,000+/month retainer', us: '$250/month, cancel anytime' },
  { them: 'Weeks to produce one lead magnet', us: 'Create unlimited lead magnets on demand' },
  { them: 'Generic copywriter output', us: 'YOUR expertise extracted, not ghostwritten' },
  { them: 'Manual lead follow-up', us: 'Automated comment-to-DM flow via LeadShark' },
  { them: 'Separate tools for pages & email', us: 'Landing pages, emails, and automation built in' },
  { them: 'You manage the agency', us: 'Self-serve — launch a full funnel in one session' },
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
      'Email sequences',
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
            The anti-generic lead magnet generator
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Create lead magnets your ICP{' '}
            <span className="text-primary">actually wants</span>
          </h1>
          <p className="mb-10 text-xl text-muted-foreground">
            Extract YOUR unique expertise, generate landing pages and email sequences,
            and automate delivery through LeadShark — all in one platform.
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
                Then you need separate tools for landing pages, email sequences, and delivery.
                It&apos;s a mess.
              </p>
            </div>
            <div className="rounded-xl border bg-primary/5 p-6">
              <h3 className="mb-4 text-xl font-semibold text-primary">Our Solution</h3>
              <p className="text-muted-foreground">
                MagnetLab extracts YOUR unique expertise, builds the landing page and email sequence,
                and integrates with LeadShark for automated LinkedIn delivery. One platform, zero duct tape.
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
            From expertise extraction to automated delivery — everything you need to turn
            LinkedIn engagement into leads.
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
