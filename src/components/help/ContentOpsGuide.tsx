'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Clock,
  CalendarDays,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Lightbulb,
  Mail,
  PenTool,
  Magnet,
  RotateCcw,
  Wifi,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// ── Collapsible FAQ section ─────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-muted/50"
      >
        <Icon size={18} className="shrink-0 text-violet-500" />
        <span className="flex-1 font-semibold text-sm">{title}</span>
        {open ? (
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <CardContent className="border-t pt-4 pb-5">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Numbered step ───────────────────────────────────────

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-bold text-violet-600 dark:text-violet-400">
        {number}
      </div>
      <div className="text-sm text-foreground leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}

// ── Troubleshooting row ─────────────────────────────────

function TroubleshootRow({
  icon: Icon,
  problem,
  solution,
}: {
  icon: LucideIcon;
  problem: string;
  solution: string;
}) {
  return (
    <div className="flex gap-3 py-3 border-b last:border-b-0 border-muted">
      <Icon size={16} className="shrink-0 text-amber-500 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-foreground">{problem}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{solution}</p>
      </div>
    </div>
  );
}

// ── Quick-tag chip preview ──────────────────────────────

const QUICK_TAGS = [
  'Too formal',
  'Too long',
  'Wrong tone',
  'Missing story',
  'Too salesy',
  'Good as-is',
];

// ── Main guide component ────────────────────────────────

export function ContentOpsGuide() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Content Operations Guide</h1>
        <p className="mt-2 text-muted-foreground">
          Your daily and weekly playbook for running AI-powered content production.
          Follow these routines and the system handles the rest.
        </p>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="daily" className="gap-1.5">
            <Clock size={14} />
            <span className="hidden sm:inline">Daily</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5">
            <CalendarDays size={14} />
            <span className="hidden sm:inline">Weekly</span>
          </TabsTrigger>
          <TabsTrigger value="troubleshoot" className="gap-1.5">
            <AlertTriangle size={14} />
            <span className="hidden sm:inline">Fix</span>
          </TabsTrigger>
          <TabsTrigger value="style" className="gap-1.5">
            <Sparkles size={14} />
            <span className="hidden sm:inline">Style</span>
          </TabsTrigger>
        </TabsList>

        {/* ──────── Daily Routine ──────── */}
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={18} className="text-violet-500" />
                Daily Routine
                <Badge variant="secondary" className="ml-auto font-normal">15-30 min</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  LinkedIn Posts
                </h3>
                <Step number={1}>
                  Open MagnetLab and go to <strong>Posts</strong>. Switch to your profile if you have multiple.
                </Step>
                <Step number={2}>
                  Review AI drafts in your buffer (typically 3-5 waiting).
                </Step>
                <Step number={3}>
                  Edit what needs editing. <em>Your edits train the AI -- be honest, change what you don&apos;t like.</em>
                </Step>
                <Step number={4}>
                  Optionally tag drafts: &quot;too formal&quot;, &quot;needs story&quot;, etc. (quick-tag chips appear after saving).
                </Step>
                <Step number={5}>
                  Approve 1 post. It publishes at your scheduled time.
                </Step>
              </div>

              <div className="h-px bg-border my-4" />

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Email Newsletter
                </h3>
                <Step number={6}>
                  Switch to <strong>Email</strong>. Review today&apos;s AI email draft.
                </Step>
                <Step number={7}>
                  Edit for depth and utility -- emails should be meatier than LinkedIn posts.
                </Step>
                <Step number={8}>
                  Send to your subscriber list.
                </Step>
              </div>

              <div className="mt-6 rounded-lg bg-violet-500/5 border border-violet-500/20 p-4">
                <div className="flex items-start gap-2">
                  <Lightbulb size={16} className="shrink-0 text-violet-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Pro tip:</strong> The more consistently you edit and give feedback,
                    the faster the AI adapts to your voice. Most CEOs see noticeable improvement within 1-2 weeks.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────── Weekly Routine ──────── */}
        <TabsContent value="weekly">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays size={18} className="text-violet-500" />
                Weekly Routine
                <Badge variant="secondary" className="ml-auto font-normal">30-60 min</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Lead Magnet Production
                </h3>
                <Step number={1}>
                  Review 3 suggested lead magnet topics (generated from your knowledge base).
                </Step>
                <Step number={2}>
                  Pick one. The AI generates the full content.
                </Step>
                <Step number={3}>
                  Review and edit content blocks as needed.
                </Step>
                <Step number={4}>
                  Approve the lead magnet. A funnel page goes live automatically.
                </Step>
                <Step number={5}>
                  Promotional posts are auto-added to your buffer for the week.
                </Step>
              </div>

              <div className="mt-6 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">What happens next:</strong> Once you approve a lead magnet,
                    the system automatically creates a funnel page, generates promotional LinkedIn posts,
                    and adds them to your content buffer. You just review and approve as part of your daily routine.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────── Troubleshooting ──────── */}
        <TabsContent value="troubleshoot" className="space-y-4">
          <div className="mb-2">
            <h2 className="text-lg font-semibold">When Things Go Wrong</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Quick fixes for common issues. If none of these help, use the feedback button in the bottom-right corner.
            </p>
          </div>

          <CollapsibleSection title="Post Buffer is Empty" icon={PenTool} defaultOpen>
            <TroubleshootRow
              icon={RotateCcw}
              problem="No posts waiting in the buffer"
              solution='Go to Posts > Schedule tab and click the "Run Autopilot" button. This generates a fresh batch of drafts from your knowledge base.'
            />
          </CollapsibleSection>

          <CollapsibleSection title="Post Didn't Publish" icon={PenTool}>
            <TroubleshootRow
              icon={Wifi}
              problem="An approved post didn't go out at the scheduled time"
              solution="Go to Settings > Integrations and check your Unipile (LinkedIn) connection. Reconnect if the status shows disconnected."
            />
          </CollapsibleSection>

          <CollapsibleSection title="Email Didn't Send" icon={Mail}>
            <TroubleshootRow
              icon={Mail}
              problem="Email broadcast was approved but subscribers didn't receive it"
              solution="Check two things: (1) Your subscriber count -- you need at least 1 subscriber. (2) Your Resend connection in Settings > Integrations."
            />
          </CollapsibleSection>

          <CollapsibleSection title="AI Tone Still Off After Edits" icon={Sparkles}>
            <TroubleshootRow
              icon={MessageSquare}
              problem="The AI keeps writing in a style that doesn't match yours"
              solution='Leave detailed style notes when editing. Use specific feedback like "too corporate -- I speak casually" rather than just tagging "wrong tone". The AI reviews feedback weekly and needs 1-2 weeks to fully adapt.'
            />
          </CollapsibleSection>

          <CollapsibleSection title="Lead Magnet Generation Failed" icon={Magnet}>
            <TroubleshootRow
              icon={AlertTriangle}
              problem="Lead magnet content didn't generate after approval"
              solution="Try again from the Lead Magnets page. If it fails repeatedly, check that you have knowledge entries -- the AI needs source material to work from."
            />
          </CollapsibleSection>

          <CollapsibleSection title="Need More Help" icon={HelpCircle}>
            <div className="text-sm text-muted-foreground">
              <p>
                Click the <strong>feedback button</strong> in the bottom-right corner of any page to send a message
                directly to the team. Include what you were trying to do and what happened instead.
              </p>
            </div>
          </CollapsibleSection>
        </TabsContent>

        {/* ──────── Style Feedback ──────── */}
        <TabsContent value="style">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles size={18} className="text-violet-500" />
                  How Style Learning Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Every edit you make teaches the AI. Be authentic -- change anything that doesn&apos;t sound like you.
                  The system tracks your changes and evolves its writing style to match yours over time.
                </p>

                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold">How it works behind the scenes:</h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>You edit an AI draft (changing words, rewriting sections, adjusting tone)</li>
                    <li>The system captures your edit and classifies the type of change</li>
                    <li>Quick-tag chips let you add context (optional but speeds up learning)</li>
                    <li>The AI reviews all your feedback weekly and updates its writing style</li>
                    <li>Future drafts reflect your preferences more accurately</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick-Tag Chips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  After saving an edit, you&apos;ll see quick-tag chips. Tap any that apply:
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-default px-3 py-1.5 text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  These tags help the AI understand <em>what kind</em> of issue you noticed.
                  You don&apos;t need to use them every time, but they speed up the learning process.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Writing Style Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  When you want to explain <em>why</em> you made a change, add a note.
                  This is optional but helps the AI learn faster.
                </p>

                <div className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Good note</p>
                    <p className="text-sm text-muted-foreground italic">
                      &quot;I never use corporate jargon like &apos;leverage&apos; or &apos;synergy&apos;. I say &apos;use&apos; and &apos;work together&apos;.&quot;
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Good note</p>
                    <p className="text-sm text-muted-foreground italic">
                      &quot;I always open with a personal story or question, never a generic statement.&quot;
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Less helpful</p>
                    <p className="text-sm text-muted-foreground italic">
                      &quot;Fix the tone.&quot;
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-violet-500/5 border border-violet-500/20 p-4">
                  <div className="flex items-start gap-2">
                    <Lightbulb size={16} className="shrink-0 text-violet-500 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Timeline:</strong> Give the AI 1-2 weeks of consistent editing
                      to fully adapt to your style. The more specific your feedback, the faster it learns.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
