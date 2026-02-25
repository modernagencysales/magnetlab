import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, MessageSquare, Users, Zap, Calendar, BookOpen, Target } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Join the LinkedIn Growth Community | MagnetLab',
  description:
    'Free Slack community for LinkedIn growth. Get real support, live strategy sessions, and book a free 30-min LinkedIn strategy call.',
};

// TODO: Replace with actual Slack invite link from Slack admin (Settings > Invite People > Share Invite Link)
const SLACK_JOIN_URL = 'https://join.slack.com/t/modernagencysales/shared_invite/zt-placeholder';
const STRATEGY_CALL_URL =
  'https://cal.com/vlad-timinski-pqqica/linkedin-strategy-call?overlayCalendar=true';

const benefits = [
  {
    icon: Users,
    title: 'Active Community',
    description:
      'Connect with other agency owners and B2B founders growing on LinkedIn. Real conversations, not a ghost town.',
  },
  {
    icon: Zap,
    title: 'Live Support',
    description:
      'Get answers to your LinkedIn strategy questions in real-time from people who have done it.',
  },
  {
    icon: Target,
    title: 'Proven Playbooks',
    description:
      'Access the same LinkedIn growth strategies our clients use to book 10-20 calls/month.',
  },
  {
    icon: Calendar,
    title: 'Free Strategy Call',
    description:
      'Book a 30-minute call with our team. We will review your profile and give you a custom growth plan.',
  },
  {
    icon: BookOpen,
    title: 'Resources & Templates',
    description:
      'Pinned guides, post templates, and outreach scripts — ready to use.',
  },
  {
    icon: MessageSquare,
    title: 'Direct Access',
    description:
      'Skip the email back-and-forth. Ask questions and get feedback directly in Slack.',
  },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <div className="mb-6 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Free LinkedIn Growth Community
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-5xl">
            Grow Your LinkedIn.{' '}
            <span className="text-primary">Together.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Join our free Slack community of agency owners and B2B founders who are actively
            growing on LinkedIn. Get real support, proven strategies, and book a free strategy
            call with our team.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href={SLACK_JOIN_URL}
              className="flex items-center gap-2 rounded-lg bg-[#4A154B] px-8 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              Join the Slack Community
            </Link>
            <Link
              href={STRATEGY_CALL_URL}
              className="flex items-center gap-2 rounded-lg border px-8 py-4 text-lg font-medium transition-colors hover:bg-muted"
            >
              Book a Free Strategy Call
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">What You Get</h2>
          <p className="mb-12 text-center text-lg text-muted-foreground">
            Everything you need to grow on LinkedIn — for free
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-xl border bg-card p-6">
                <benefit.icon className="mb-4 h-8 w-8 text-primary" />
                <h3 className="mb-2 text-lg font-semibold">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strategy Call CTA */}
      <section className="py-20">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Want a Custom LinkedIn Growth Plan?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Book a free 30-minute strategy call with our team. We will review your LinkedIn
            profile, identify what is working, and give you a step-by-step plan to start
            booking more calls from LinkedIn.
          </p>
          <Link
            href={STRATEGY_CALL_URL}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Book Your Free Strategy Call
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Grow?</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join hundreds of agency owners and B2B founders in our free Slack community.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href={SLACK_JOIN_URL}
              className="flex items-center gap-2 rounded-lg bg-[#4A154B] px-8 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              Join Slack
            </Link>
            <Link
              href={STRATEGY_CALL_URL}
              className="flex items-center gap-2 rounded-lg border px-8 py-4 text-lg font-medium transition-colors hover:bg-muted"
            >
              Book a Strategy Call
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto max-w-6xl px-4 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Modern Agency Sales. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
