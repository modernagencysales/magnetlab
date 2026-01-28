'use client';

import { Monitor, Smartphone, CheckCircle2, Play } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import type { QualificationQuestion, FunnelTheme, BackgroundStyle } from '@/lib/types/funnel';

interface FunnelPreviewProps {
  headline: string;
  subline: string;
  buttonText: string;
  socialProof: string;
  questions: QualificationQuestion[];
  theme?: FunnelTheme;
  primaryColor?: string;
  backgroundStyle?: BackgroundStyle;
  logoUrl?: string | null;
  // Thank you page props
  thankyouHeadline?: string;
  thankyouSubline?: string;
  vslUrl?: string;
  calendlyUrl?: string;
}

export function FunnelPreview({
  headline,
  subline,
  buttonText,
  socialProof,
  questions,
  theme = 'dark',
  primaryColor = '#8b5cf6',
  backgroundStyle = 'solid',
  logoUrl,
  thankyouHeadline = 'Thanks! Check your email.',
  thankyouSubline = '',
  vslUrl = '',
  calendlyUrl = '',
}: FunnelPreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [pageView, setPageView] = useState<'optin' | 'thankyou'>('optin');

  // Theme-based colors - memoized to avoid recalculation on every render
  const isDark = theme === 'dark';
  const colors = useMemo(() => ({
    bgColor: isDark ? '#09090B' : '#FAFAFA',
    textColor: isDark ? '#FAFAFA' : '#09090B',
    mutedColor: isDark ? '#A1A1AA' : '#71717A',
    borderColor: isDark ? '#27272A' : '#E4E4E7',
    inputBg: isDark ? '#09090B' : '#FFFFFF',
    placeholderColor: isDark ? '#71717A' : '#A1A1AA',
    browserBg: isDark ? '#18181B' : '#F4F4F5',
    browserBorder: isDark ? '#27272A' : '#E4E4E7',
  }), [isDark]);

  const { bgColor, textColor, mutedColor, borderColor, inputBg, placeholderColor, browserBg, browserBorder } = colors;

  // Background style - memoized
  const getBackgroundStyle = useCallback(() => {
    if (backgroundStyle === 'gradient') {
      return isDark
        ? `linear-gradient(135deg, ${bgColor} 0%, #18181B 50%, ${bgColor} 100%)`
        : `linear-gradient(135deg, ${bgColor} 0%, #FFFFFF 50%, ${bgColor} 100%)`;
    }
    if (backgroundStyle === 'pattern') {
      return isDark
        ? `radial-gradient(circle at 50% 50%, ${primaryColor}15 0%, transparent 50%), ${bgColor}`
        : `radial-gradient(circle at 50% 50%, ${primaryColor}15 0%, transparent 50%), ${bgColor}`;
    }
    return bgColor;
  }, [backgroundStyle, isDark, bgColor, primaryColor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Preview
        </h3>
        <div className="flex items-center gap-3">
          {/* Page Toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setPageView('optin')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                pageView === 'optin'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Opt-in
            </button>
            <button
              onClick={() => setPageView('thankyou')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                pageView === 'thankyou'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Thank You
            </button>
          </div>
          {/* Device Toggle */}
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
      </div>

      {/* Preview Container - Linear Dark Style */}
      <div
        className={`rounded-xl border overflow-hidden transition-all duration-300 ${
          viewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''
        }`}
      >
        {/* Simulated Browser Chrome */}
        <div
          className="px-4 py-2 flex items-center gap-2"
          style={{
            background: browserBg,
            borderBottom: `1px solid ${browserBorder}`
          }}
        >
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: borderColor }} />
            <div className="w-3 h-3 rounded-full" style={{ background: borderColor }} />
            <div className="w-3 h-3 rounded-full" style={{ background: borderColor }} />
          </div>
          <div className="flex-1 mx-4">
            <div
              className="rounded-md px-3 py-1 text-xs text-center"
              style={{ background: isDark ? '#27272A' : '#E4E4E7', color: mutedColor }}
            >
              magnetlab.app/p/username/your-page
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div
          className="min-h-[400px] p-6 flex flex-col items-center justify-center text-center"
          style={{ background: getBackgroundStyle() }}
        >
          {pageView === 'optin' ? (
            /* Opt-in Page Preview */
            <div className="max-w-md space-y-6">
              {/* Logo */}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 w-auto mx-auto"
                />
              )}

              {/* Headline */}
              <h1
                className="text-2xl font-semibold leading-tight"
                style={{ color: textColor }}
              >
                {headline || 'Your Headline Here'}
              </h1>

              {/* Subline */}
              {subline && (
                <p
                  className="text-base leading-relaxed"
                  style={{ color: mutedColor }}
                >
                  {subline}
                </p>
              )}

              {/* Email Form Preview */}
              <div className="space-y-3 w-full max-w-sm mx-auto">
                <div
                  className="rounded-lg px-4 py-3 text-sm text-left"
                  style={{
                    background: inputBg,
                    border: `1px solid ${borderColor}`,
                    color: placeholderColor,
                  }}
                >
                  Enter your email...
                </div>

                <button
                  className="w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                  style={{
                    background: primaryColor,
                    color: '#FFFFFF',
                  }}
                >
                  {buttonText || 'Get Free Access'}
                </button>
              </div>

              {/* Social Proof */}
              {socialProof && (
                <p
                  className="text-xs"
                  style={{ color: placeholderColor }}
                >
                  {socialProof}
                </p>
              )}
            </div>
          ) : (
            /* Thank You Page Preview */
            <div className="max-w-md space-y-6 w-full">
              {/* Logo */}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 w-auto mx-auto"
                />
              )}

              {/* Success Icon */}
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-full mx-auto"
                style={{ background: isDark ? '#18181B' : '#FFFFFF' }}
              >
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>

              {/* Thank You Headline */}
              <h1
                className="text-2xl font-semibold leading-tight"
                style={{ color: textColor }}
              >
                {thankyouHeadline || 'Thanks! Check your email.'}
              </h1>

              {/* Thank You Subline */}
              {thankyouSubline && (
                <p
                  className="text-base leading-relaxed"
                  style={{ color: mutedColor }}
                >
                  {thankyouSubline}
                </p>
              )}

              {/* Video Placeholder */}
              {vslUrl && (
                <div
                  className="rounded-lg overflow-hidden w-full aspect-video flex items-center justify-center"
                  style={{ background: isDark ? '#18181B' : '#E4E4E7' }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: primaryColor }}
                    >
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    </div>
                    <span className="text-xs" style={{ color: mutedColor }}>Video Preview</span>
                  </div>
                </div>
              )}

              {/* Questions Preview */}
              {questions.length > 0 && (
                <div
                  className="rounded-lg p-4 text-left space-y-3"
                  style={{ background: isDark ? '#18181B' : '#FFFFFF', border: `1px solid ${borderColor}` }}
                >
                  <p className="text-xs" style={{ color: placeholderColor }}>
                    Question 1 of {questions.length}
                  </p>
                  <p className="text-sm font-medium" style={{ color: textColor }}>
                    {questions[0]?.questionText || 'Sample question?'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-lg px-3 py-2 text-xs"
                      style={{ background: isDark ? '#09090B' : '#FAFAFA', border: `1px solid ${borderColor}`, color: textColor }}
                    >
                      Yes
                    </button>
                    <button
                      className="flex-1 rounded-lg px-3 py-2 text-xs"
                      style={{ background: isDark ? '#09090B' : '#FAFAFA', border: `1px solid ${borderColor}`, color: textColor }}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}

              {/* Calendly Placeholder */}
              {calendlyUrl && (
                <div
                  className="rounded-lg p-4 text-center"
                  style={{ background: isDark ? '#18181B' : '#FFFFFF', border: `1px solid ${borderColor}` }}
                >
                  <p className="text-sm font-medium mb-2" style={{ color: textColor }}>Book Your Call</p>
                  <p className="text-xs" style={{ color: mutedColor }}>Calendly embed will appear here</p>
                </div>
              )}
            </div>
          )}
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
