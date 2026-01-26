'use client';

import { Video, Calendar, MessageCircle } from 'lucide-react';

interface ThankyouPageEditorProps {
  headline: string;
  setHeadline: (value: string) => void;
  subline: string;
  setSubline: (value: string) => void;
  vslUrl: string;
  setVslUrl: (value: string) => void;
  calendlyUrl: string;
  setCalendlyUrl: (value: string) => void;
  passMessage: string;
  setPassMessage: (value: string) => void;
  failMessage: string;
  setFailMessage: (value: string) => void;
}

export function ThankyouPageEditor({
  headline,
  setHeadline,
  subline,
  setSubline,
  vslUrl,
  setVslUrl,
  calendlyUrl,
  setCalendlyUrl,
  passMessage,
  setPassMessage,
  failMessage,
  setFailMessage,
}: ThankyouPageEditorProps) {
  return (
    <div className="space-y-6">
      {/* Thank-you Message */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Thank-you Message
        </h3>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Headline
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            placeholder="Thanks! Check your email."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Subline
            <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={subline}
            onChange={(e) => setSubline(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
            placeholder="Your free resource is on its way. While you wait..."
          />
        </div>
      </div>

      {/* Video Sales Letter */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Video (Optional)
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Video URL
          </label>
          <input
            type="url"
            value={vslUrl}
            onChange={(e) => setVslUrl(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Supports YouTube, Loom, and Vimeo URLs
          </p>
        </div>
      </div>

      {/* Calendly */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Calendly Booking (Optional)
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Calendly URL
          </label>
          <input
            type="url"
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            placeholder="https://calendly.com/your-name/30min"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Embed a Calendly widget for qualified leads to book calls
          </p>
        </div>
      </div>

      {/* Qualification Messages */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-500" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Qualification Messages
          </h3>
        </div>

        <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-4">
          <label className="block text-sm font-medium mb-1.5 text-green-800 dark:text-green-200">
            Qualified Lead Message
          </label>
          <textarea
            value={passMessage}
            onChange={(e) => setPassMessage(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-green-900/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-none"
            placeholder="Great! You're a perfect fit. Book a call below."
          />
          <p className="mt-1 text-xs text-green-700 dark:text-green-300">
            Shown when they pass all qualification questions
          </p>
        </div>

        <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/20 p-4">
          <label className="block text-sm font-medium mb-1.5 text-amber-800 dark:text-amber-200">
            Non-Qualified Lead Message
          </label>
          <textarea
            value={failMessage}
            onChange={(e) => setFailMessage(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-900/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors resize-none"
            placeholder="Thanks for your interest! This might not be the right fit right now."
          />
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Shown when they don&apos;t match your ideal customer criteria
          </p>
        </div>
      </div>
    </div>
  );
}
