'use client';

import { Monitor, Smartphone } from 'lucide-react';
import { useState } from 'react';
import type { QualificationQuestion } from '@/lib/types/funnel';

interface FunnelPreviewProps {
  headline: string;
  subline: string;
  buttonText: string;
  socialProof: string;
  questions: QualificationQuestion[];
}

export function FunnelPreview({
  headline,
  subline,
  buttonText,
  socialProof,
  questions,
}: FunnelPreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Preview
        </h3>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setViewMode('desktop')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'desktop'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'mobile'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview Container - Linear Dark Style */}
      <div
        className={`rounded-xl border overflow-hidden transition-all duration-300 ${
          viewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''
        }`}
      >
        {/* Simulated Browser Chrome */}
        <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 border-b border-zinc-800">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-zinc-700" />
            <div className="w-3 h-3 rounded-full bg-zinc-700" />
            <div className="w-3 h-3 rounded-full bg-zinc-700" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-zinc-800 rounded-md px-3 py-1 text-xs text-zinc-500 text-center">
              magnetlab.app/p/username/your-page
            </div>
          </div>
        </div>

        {/* Page Content - Linear Dark Design */}
        <div
          className="min-h-[400px] p-6 flex flex-col items-center justify-center text-center"
          style={{ background: '#09090B' }}
        >
          {/* Main Content */}
          <div className="max-w-md space-y-6">
            {/* Headline */}
            <h1
              className="text-2xl font-semibold leading-tight"
              style={{ color: '#FAFAFA' }}
            >
              {headline || 'Your Headline Here'}
            </h1>

            {/* Subline */}
            {subline && (
              <p
                className="text-base leading-relaxed"
                style={{ color: '#A1A1AA' }}
              >
                {subline}
              </p>
            )}

            {/* Email Form Preview */}
            <div className="space-y-3 w-full max-w-sm mx-auto">
              <div
                className="rounded-lg px-4 py-3 text-sm text-left"
                style={{
                  background: '#09090B',
                  border: '1px solid #27272A',
                  color: '#71717A',
                }}
              >
                Enter your email...
              </div>

              <button
                className="w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  background: '#8B5CF6',
                  color: '#FAFAFA',
                }}
              >
                {buttonText || 'Get Free Access'}
              </button>
            </div>

            {/* Social Proof */}
            {socialProof && (
              <p
                className="text-xs"
                style={{ color: '#71717A' }}
              >
                {socialProof}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Questions Preview */}
      {questions.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Qualification Flow Preview
          </h4>
          <div className="space-y-2">
            {questions.slice(0, 3).map((q, i) => (
              <div
                key={q.id}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span className="text-muted-foreground truncate">
                  {q.questionText}
                </span>
                <span className="ml-auto text-xs text-green-600 dark:text-green-400">
                  {q.qualifyingAnswer === 'yes' ? 'Yes' : 'No'} = Qualified
                </span>
              </div>
            ))}
            {questions.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{questions.length - 3} more questions...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
