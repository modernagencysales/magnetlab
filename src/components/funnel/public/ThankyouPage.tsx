'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { VideoEmbed } from './VideoEmbed';
import { CalendlyEmbed } from './CalendlyEmbed';
import { getThemeVars } from '@/lib/utils/theme-vars';
import { SectionRenderer } from '@/components/ds';
import { PixelScripts, type PixelConfig } from './PixelScripts';
import { FontLoader, getFontStyle } from './FontLoader';
import type { FunnelPageSection } from '@/lib/types/funnel';

import { logError } from '@/lib/utils/logger';
import * as publicApi from '@/frontend/api/public';

type AnswerType = 'yes_no' | 'text' | 'textarea' | 'multiple_choice';

// Extracted qualification result component
function QualificationResult({ isQualified, passMessage, failMessage }: {
  isQualified: boolean;
  passMessage: string;
  failMessage: string;
}) {
  return (
    <div
      className={`rounded-xl p-6 text-center ${
        isQualified
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-destructive/10 border border-destructive/30'
      }`}
    >
      {isQualified ? (
        <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-500" />
      ) : (
        <XCircle className="mx-auto mb-3 w-8 h-8 text-destructive" />
      )}
      <p className={`font-medium ${isQualified ? 'text-green-500' : 'text-destructive'}`}>
        {isQualified ? passMessage : failMessage}
      </p>
    </div>
  );
}

// Extracted survey card component used by all layouts
function SurveyCard({
  questions,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  currentTextValue,
  setCurrentTextValue,
  answers,
  error,
  setError,
  submitting,
  primaryColor,
  currentQuestion,
  handleYesNoAnswer,
  handleTextSubmit,
  handleMultipleChoiceSelect,
  handleSkip,
}: {
  questions: Question[];
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (i: number) => void;
  currentTextValue: string;
  setCurrentTextValue: (v: string) => void;
  answers: Record<string, string>;
  error: string | null;
  setError: (e: string | null) => void;
  submitting: boolean;
  primaryColor: string;
  currentQuestion: Question | undefined;
  handleYesNoAnswer: (answer: 'yes' | 'no') => void;
  handleTextSubmit: () => void;
  handleMultipleChoiceSelect: (option: string) => void;
  handleSkip: () => void;
}) {
  return (
    <div className="relative">
      {/* Background glow */}
      <div
        className="absolute -inset-3 rounded-2xl blur-xl opacity-30 pointer-events-none"
        style={{ background: primaryColor }}
      />
      <div
        className="relative rounded-xl p-4 sm:p-6 md:p-8 space-y-6"
        style={{
          background: 'var(--ds-card)',
          border: `2px solid color-mix(in srgb, ${primaryColor} 40%, transparent)`,
          boxShadow: `0 0 30px color-mix(in srgb, ${primaryColor} 15%, transparent)`,
        }}
      >
        {/* Time estimate pill */}
        <div className="flex justify-center -mt-8 sm:-mt-10 md:-mt-12 mb-2">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ background: primaryColor }}
          >
            {questions.length <= 3 ? '30-second' : '2-minute'} survey
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentQuestionIndex > 0 && (
              <button
                onClick={() => {
                  setCurrentQuestionIndex(currentQuestionIndex - 1);
                  setCurrentTextValue(answers[questions[currentQuestionIndex - 1]?.id] || '');
                  setError(null);
                }}
                className="text-xs transition-opacity hover:opacity-80"
                style={{ color: 'var(--ds-muted)' }}
              >
                &larr; Back
              </button>
            )}
            <p className="text-sm" style={{ color: 'var(--ds-placeholder)' }}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: i <= currentQuestionIndex ? 'var(--ds-primary)' : 'var(--ds-border)'
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {submitting ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ds-primary)' }} />
          </div>
        ) : (
          <>
            <p className="text-lg font-medium" style={{ color: 'var(--ds-text)' }}>
              {currentQuestion?.questionText}
            </p>

            {/* Yes/No buttons */}
            {currentQuestion?.answerType === 'yes_no' && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleYesNoAnswer('yes')}
                  className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-green-500"
                  style={{ background: 'var(--ds-card)', border: '1px solid var(--ds-border)', color: 'var(--ds-text)' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleYesNoAnswer('no')}
                  className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-destructive"
                  style={{ background: 'var(--ds-card)', border: '1px solid var(--ds-border)', color: 'var(--ds-text)' }}
                >
                  No
                </button>
              </div>
            )}

            {/* Short text input */}
            {currentQuestion?.answerType === 'text' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={currentTextValue}
                  onChange={(e) => setCurrentTextValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                  placeholder={currentQuestion.placeholder || 'Type your answer...'}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
                  style={{ background: 'var(--ds-card)', border: '1px solid var(--ds-border)', color: 'var(--ds-text)' }}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  {!currentQuestion.isRequired && (
                    <button
                      onClick={handleSkip}
                      className="text-sm transition-colors"
                      style={{ color: 'var(--ds-placeholder)' }}
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={handleTextSubmit}
                    className="ml-auto rounded-lg px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--ds-primary)' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Long text (textarea) input */}
            {currentQuestion?.answerType === 'textarea' && (
              <div className="space-y-3">
                <textarea
                  value={currentTextValue}
                  onChange={(e) => setCurrentTextValue(e.target.value)}
                  placeholder={currentQuestion.placeholder || 'Type your answer...'}
                  rows={4}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors resize-none"
                  style={{ background: 'var(--ds-card)', border: '1px solid var(--ds-border)', color: 'var(--ds-text)' }}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  {!currentQuestion.isRequired && (
                    <button
                      onClick={handleSkip}
                      className="text-sm transition-colors"
                      style={{ color: 'var(--ds-placeholder)' }}
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={handleTextSubmit}
                    className="ml-auto rounded-lg px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--ds-primary)' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Multiple choice radio buttons */}
            {currentQuestion?.answerType === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleMultipleChoiceSelect(option)}
                      className="w-full text-left rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                      style={{ background: 'var(--ds-card)', border: '1px solid var(--ds-border)', color: 'var(--ds-text)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = primaryColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {!currentQuestion.isRequired && (
                  <button
                    onClick={handleSkip}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--ds-placeholder)' }}
                  >
                    Skip
                  </button>
                )}
              </div>
            )}

            {/* Fallback for unknown type - treat as yes/no */}
            {currentQuestion && !['yes_no', 'text', 'textarea', 'multiple_choice'].includes(currentQuestion.answerType) && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleYesNoAnswer('yes')}
                  className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-green-500"
                  style={{ background: 'var(--ds-card)', border: '1px solid var(--ds-border)', color: 'var(--ds-text)' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleYesNoAnswer('no')}
                  className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-destructive"
                  style={{ background: 'var(--ds-card)', border: '1px solid var(--ds-border)', color: 'var(--ds-text)' }}
                >
                  No
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface Question {
  id: string;
  questionText: string;
  questionOrder: number;
  answerType: AnswerType;
  options: string[] | null;
  placeholder: string | null;
  isRequired: boolean;
  bookingPrefillKey: string | null;
}

interface ThankyouPageProps {
  leadId: string | null;
  headline: string;
  subline: string | null;
  vslUrl: string | null;
  calendlyUrl: string | null;
  passMessage: string;
  failMessage: string;
  questions: Question[];
  theme?: 'dark' | 'light';
  primaryColor?: string;
  backgroundStyle?: 'solid' | 'gradient' | 'pattern';
  logoUrl?: string | null;
  contentPageUrl?: string | null;
  leadMagnetTitle?: string | null;
  sections?: FunnelPageSection[];
  pixelConfig?: PixelConfig;
  funnelPageId?: string;
  fontFamily?: string | null;
  fontUrl?: string | null;
  hideBranding?: boolean;
  redirectTrigger?: 'none' | 'immediate' | 'after_qualification';
  redirectUrl?: string | null;
  redirectFailUrl?: string | null;
  email?: string | null;
  homepageUrl?: string | null;
  homepageLabel?: string | null;
  showResourceOnPage?: boolean;
  layout?: 'survey_first' | 'video_first' | 'side_by_side';
  vslHeadline?: string | null;
  vslSubline?: string | null;
  ctaHeadline?: string | null;
  ctaButtonText?: string | null;
  leadName?: string | null;
}

export function ThankyouPage({
  leadId,
  headline,
  subline,
  vslUrl,
  calendlyUrl,
  passMessage,
  failMessage,
  questions,
  theme = 'dark',
  primaryColor = '#8b5cf6',
  backgroundStyle = 'solid',
  logoUrl,
  contentPageUrl,
  sections = [],
  pixelConfig,
  funnelPageId,
  fontFamily,
  fontUrl,
  hideBranding,
  redirectTrigger = 'none',
  redirectUrl,
  redirectFailUrl,
  email,
  homepageUrl,
  homepageLabel,
  showResourceOnPage,
  layout = 'survey_first',
  vslHeadline,
  vslSubline,
  ctaHeadline,
  ctaButtonText,
  leadName,
}: ThankyouPageProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentTextValue, setCurrentTextValue] = useState('');
  const [qualificationComplete, setQualificationComplete] = useState(questions.length === 0);
  const [isQualified, setIsQualified] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyWasCompleted, setSurveyWasCompleted] = useState(false);
  const [ctaClicked, setCtaClicked] = useState(false);
  const bookingRef = useRef<HTMLDivElement>(null);
  const surveyRef = useRef<HTMLDivElement>(null);

  const themeVars = getThemeVars(theme, primaryColor);
  const isDark = theme === 'dark';

  // Background style
  const getBackgroundStyle = (): string => {
    const bgColor = isDark ? '#09090B' : '#FAFAFA';
    if (backgroundStyle === 'gradient') {
      return isDark
        ? `linear-gradient(135deg, ${bgColor} 0%, #18181B 50%, ${bgColor} 100%)`
        : `linear-gradient(135deg, ${bgColor} 0%, #FFFFFF 50%, ${bgColor} 100%)`;
    }
    if (backgroundStyle === 'pattern') {
      return `radial-gradient(circle at 50% 50%, ${primaryColor}15 0%, transparent 50%), ${bgColor}`;
    }
    return bgColor;
  };

  // Split sections into above-video and below-qualification slots
  const aboveSections = sections.filter(s => s.sortOrder < 50);
  const belowSections = sections.filter(s => s.sortOrder >= 50);

  const currentQuestion = questions[currentQuestionIndex];
  const hasQuestions = questions.length > 0;

  const submitAllAnswers = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);
    try {
      if (leadId) {
        const data = await publicApi.updateLeadQualification({ leadId, answers: finalAnswers });
        setIsQualified(data.isQualified);
      }
      setQualificationComplete(true);
      setSurveyWasCompleted(true);
      setBookingRevealed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      logError('funnel/thankyou', err, { step: 'error_submitting_qualification' });
    } finally {
      setSubmitting(false);
    }
  };

  const advanceOrSubmit = (newAnswers: Record<string, string>) => {
    setError(null);
    setCurrentTextValue('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitAllAnswers(newAnswers);
    }
  };

  const handleYesNoAnswer = (answer: 'yes' | 'no') => {
    if (!currentQuestion) return;
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    advanceOrSubmit(newAnswers);
  };

  const handleTextSubmit = () => {
    if (!currentQuestion) return;
    if (currentQuestion.isRequired && !currentTextValue.trim()) {
      setError('This question requires an answer.');
      return;
    }
    const newAnswers = { ...answers, [currentQuestion.id]: currentTextValue.trim() };
    setAnswers(newAnswers);
    advanceOrSubmit(newAnswers);
  };

  const handleMultipleChoiceSelect = (option: string) => {
    if (!currentQuestion) return;
    const newAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(newAnswers);
    advanceOrSubmit(newAnswers);
  };

  const handleSkip = () => {
    if (!currentQuestion) return;
    const newAnswers = { ...answers };
    // Don't add an answer for skipped questions
    setAnswers(newAnswers);
    advanceOrSubmit(newAnswers);
  };

  const buildPrefillData = () => {
    const surveyMappedAnswers: Record<string, string> = {};
    for (const q of questions) {
      if (q.bookingPrefillKey && answers[q.id]) {
        surveyMappedAnswers[q.bookingPrefillKey] = answers[q.id];
      }
    }
    return {
      leadName: leadName || undefined,
      leadEmail: email || undefined,
      surveyAnswers: Object.keys(surveyMappedAnswers).length > 0 ? surveyMappedAnswers : undefined,
    };
  };

  const handleCtaClick = () => {
    setCtaClicked(true);
    if (hasQuestions) {
      // Reveal survey, scroll to it after render
      setTimeout(() => {
        surveyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      // No survey — reveal booking and scroll to it
      setBookingRevealed(true);
      setTimeout(() => {
        bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  // If no questions, determine qualification (default to qualified)
  useEffect(() => {
    if (questions.length === 0) {
      setIsQualified(true);
    }
  }, [questions.length]);

  // Auto-scroll to booking embed after survey completion (only when user actively completed the survey,
  // not on initial page load when there are no questions — we want them to see the video first)
  useEffect(() => {
    if (surveyWasCompleted && qualificationComplete && isQualified && calendlyUrl && bookingRef.current) {
      const timer = setTimeout(() => {
        bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [surveyWasCompleted, qualificationComplete, isQualified, calendlyUrl]);

  // Redirect after qualification if configured
  useEffect(() => {
    if (redirectTrigger !== 'after_qualification') return;
    if (!qualificationComplete) return;

    const targetUrl = isQualified ? redirectUrl : redirectFailUrl;
    if (!targetUrl) return; // Fall through to built-in UI

    try {
      const url = new URL(targetUrl);
      if (leadId) url.searchParams.set('leadId', leadId);
      if (email) url.searchParams.set('email', email);
      window.location.href = url.toString();
    } catch {
      // Invalid URL — fall through to built-in UI
    }
  }, [qualificationComplete, isQualified, redirectTrigger, redirectUrl, redirectFailUrl, leadId, email]);

  // Track thank-you page view
  useEffect(() => {
    if (funnelPageId) {
      publicApi.trackView({ funnelPageId, pageType: 'thankyou' }).catch(() => {});
    }
  }, [funnelPageId]);

  return (
    <>
    {pixelConfig && <PixelScripts config={pixelConfig} />}
    <div
      className="min-h-screen flex flex-col items-center px-4 py-12"
      style={{ background: getBackgroundStyle(), ...themeVars, ...getFontStyle(fontFamily) }}
    >
      <FontLoader fontFamily={fontFamily || null} fontUrl={fontUrl || null} />
      <div className="w-full max-w-2xl space-y-8">
        {/* 1. Slim confirmation banner */}
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-3"
          style={{ background: 'var(--ds-card)' }}
        >
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
            {showResourceOnPage
              ? "You're in! Your resource is ready below."
              : "You're in! Check your inbox for your resource."}
          </p>
        </div>

        {/* Resource access button (when email is off) */}
        {showResourceOnPage && contentPageUrl && (
          <div className="text-center">
            <a
              href={contentPageUrl}
              className="inline-flex items-center gap-2 rounded-lg px-10 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--ds-primary)' }}
            >
              Access Your Free Resource &rarr;
            </a>
          </div>
        )}

        {/* 2. Logo */}
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="h-12 w-auto mx-auto"
          />
        )}

        {/* 3. Value headline + subline — hidden in video_first when VSL framing exists (avoids redundancy) */}
        {!(layout === 'video_first' && vslHeadline) && (
          <div className="text-center space-y-3">
            <h1
              className="text-2xl md:text-3xl font-semibold"
              style={{ color: 'var(--ds-text)' }}
            >
              {headline}
            </h1>

            {subline && (
              <p style={{ color: 'var(--ds-muted)' }}>
                {subline}
              </p>
            )}
          </div>
        )}

        {/* 4. Above-video sections (social proof) — only for survey_first layout */}
        {layout === 'survey_first' && aboveSections.length > 0 && (
          <div className="space-y-6">
            {aboveSections.map(s => <SectionRenderer key={s.id} section={s} />)}
          </div>
        )}

        {/* Layout: video_first — VSL framing + video + CTA bridge + sections + survey */}
        {layout === 'video_first' && (
          <>
            {/* VSL framing + video */}
            {vslUrl && (
              <div className="space-y-4">
                {(vslHeadline || vslSubline) && (
                  <div className="text-center space-y-2">
                    {vslHeadline && (
                      <p
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: primaryColor }}
                      >
                        {vslHeadline}
                      </p>
                    )}
                    {vslSubline && (
                      <h2
                        className="text-xl md:text-2xl font-semibold"
                        style={{ color: 'var(--ds-text)' }}
                      >
                        {vslSubline}
                      </h2>
                    )}
                  </div>
                )}
                <VideoEmbed url={vslUrl} />
              </div>
            )}

            {/* ─── Conversion Zone: CTA → Survey → Booking (same space, transforms) ─── */}
            <div ref={surveyRef}>
              {!ctaClicked ? (
                /* State 1: CTA headline + button */
                vslUrl && (ctaHeadline || ctaButtonText) ? (
                  <div className="text-center space-y-4 py-4">
                    {ctaHeadline && (
                      <p
                        className="text-lg md:text-xl font-semibold"
                        style={{ color: 'var(--ds-text)' }}
                      >
                        {ctaHeadline}
                      </p>
                    )}
                    <button
                      onClick={handleCtaClick}
                      className="inline-flex items-center rounded-lg px-10 py-4 text-lg font-bold text-white uppercase tracking-wide transition-opacity hover:opacity-90"
                      style={{ background: primaryColor }}
                    >
                      {ctaButtonText || 'BOOK YOUR CALL NOW'}
                    </button>
                  </div>
                ) : null
              ) : hasQuestions && !qualificationComplete ? (
                /* State 2: Survey (replaces CTA) */
                <SurveyCard
                  questions={questions}
                  currentQuestionIndex={currentQuestionIndex}
                  setCurrentQuestionIndex={setCurrentQuestionIndex}
                  currentTextValue={currentTextValue}
                  setCurrentTextValue={setCurrentTextValue}
                  answers={answers}
                  error={error}
                  setError={setError}
                  submitting={submitting}
                  primaryColor={primaryColor}
                  currentQuestion={currentQuestion}
                  handleYesNoAnswer={handleYesNoAnswer}
                  handleTextSubmit={handleTextSubmit}
                  handleMultipleChoiceSelect={handleMultipleChoiceSelect}
                  handleSkip={handleSkip}
                />
              ) : qualificationComplete && isQualified && calendlyUrl ? (
                /* State 3a: Booking (replaces survey) */
                <div className="space-y-4">
                  <QualificationResult isQualified={true} passMessage={passMessage} failMessage={failMessage} />
                  <CalendlyEmbed url={calendlyUrl} prefillData={buildPrefillData()} />
                </div>
              ) : qualificationComplete && isQualified === false ? (
                /* State 3b: Not qualified */
                <QualificationResult isQualified={false} passMessage={passMessage} failMessage={failMessage} />
              ) : qualificationComplete && isQualified && !calendlyUrl ? (
                /* State 3c: Qualified but no booking URL */
                <QualificationResult isQualified={true} passMessage={passMessage} failMessage={failMessage} />
              ) : null}
            </div>

            {/* Social proof sections — always visible below conversion zone */}
            {sections.length > 0 && (
              <div className="space-y-6">
                {sections.map(s => <SectionRenderer key={s.id} section={s} />)}
              </div>
            )}
          </>
        )}

        {/* Layout: side_by_side — 2-column grid (falls back to single column when no video) */}
        {layout === 'side_by_side' ? (
          vslUrl ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Video */}
              <div>
                <VideoEmbed url={vslUrl} />
              </div>
              {/* Right: Survey or qualification result */}
              <div>
                {hasQuestions && !qualificationComplete ? (
                  <SurveyCard
                    questions={questions}
                    currentQuestionIndex={currentQuestionIndex}
                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                    currentTextValue={currentTextValue}
                    setCurrentTextValue={setCurrentTextValue}
                    answers={answers}
                    error={error}
                    setError={setError}
                    submitting={submitting}
                    primaryColor={primaryColor}
                    currentQuestion={currentQuestion}
                    handleYesNoAnswer={handleYesNoAnswer}
                    handleTextSubmit={handleTextSubmit}
                    handleMultipleChoiceSelect={handleMultipleChoiceSelect}
                    handleSkip={handleSkip}
                  />
                ) : qualificationComplete && isQualified !== null ? (
                  <QualificationResult isQualified={isQualified} passMessage={passMessage} failMessage={failMessage} />
                ) : null}
              </div>
            </div>
          ) : (
            /* No video — render survey full-width */
            <>
              {hasQuestions && !qualificationComplete && (
                <SurveyCard
                  questions={questions}
                  currentQuestionIndex={currentQuestionIndex}
                  setCurrentQuestionIndex={setCurrentQuestionIndex}
                  currentTextValue={currentTextValue}
                  setCurrentTextValue={setCurrentTextValue}
                  answers={answers}
                  error={error}
                  setError={setError}
                  submitting={submitting}
                  primaryColor={primaryColor}
                  currentQuestion={currentQuestion}
                  handleYesNoAnswer={handleYesNoAnswer}
                  handleTextSubmit={handleTextSubmit}
                  handleMultipleChoiceSelect={handleMultipleChoiceSelect}
                  handleSkip={handleSkip}
                />
              )}
            </>
          )
        ) : (
          <>
            {/* Survey card — for survey_first layout only (video_first has its own) */}
            {layout === 'survey_first' && hasQuestions && !qualificationComplete && (
              <SurveyCard
                questions={questions}
                currentQuestionIndex={currentQuestionIndex}
                setCurrentQuestionIndex={setCurrentQuestionIndex}
                currentTextValue={currentTextValue}
                setCurrentTextValue={setCurrentTextValue}
                answers={answers}
                error={error}
                setError={setError}
                submitting={submitting}
                primaryColor={primaryColor}
                currentQuestion={currentQuestion}
                handleYesNoAnswer={handleYesNoAnswer}
                handleTextSubmit={handleTextSubmit}
                handleMultipleChoiceSelect={handleMultipleChoiceSelect}
                handleSkip={handleSkip}
              />
            )}

            {/* Video — for survey_first: shown after survey completion */}
            {layout === 'survey_first' && vslUrl && (qualificationComplete || !hasQuestions) && (
              <VideoEmbed url={vslUrl} />
            )}
          </>
        )}

        {/* 8. Qualification Result — skip for video_first (handled inside conversion zone) and side_by_side with video */}
        {layout !== 'video_first' && hasQuestions && qualificationComplete && isQualified !== null && !(layout === 'side_by_side' && vslUrl) && (
          <QualificationResult isQualified={isQualified} passMessage={passMessage} failMessage={failMessage} />
        )}

        {/* Homepage link */}
        {homepageUrl && (
          <div className="text-center">
            <a
              href={homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--ds-primary)' }}
            >
              {homepageLabel || 'Visit our website'}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        )}

        {/* 9. Below-content sections (video_first renders all sections inline) */}
        {layout !== 'video_first' && belowSections.length > 0 && (
          <div className="space-y-6">
            {belowSections.map(s => <SectionRenderer key={s.id} section={s} />)}
          </div>
        )}
      </div>

      {/* 10. Booking embed — skip for video_first (handled inside conversion zone) */}
      {layout !== 'video_first' && qualificationComplete && isQualified && calendlyUrl && (
        <div ref={bookingRef} className="w-full max-w-5xl px-4 mt-8 space-y-4">
          <h3
            className="text-lg font-semibold text-center"
            style={{ color: 'var(--ds-text)' }}
          >
            Book Your Call
          </h3>
          <CalendlyEmbed url={calendlyUrl} prefillData={buildPrefillData()} />
        </div>
      )}

      {/* 11. Powered by MagnetLab */}
      {!hideBranding && (
        <div className="mt-12">
          <a
            href="https://magnetlab.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--ds-placeholder)' }}
          >
            Powered by MagnetLab
          </a>
        </div>
      )}
    </div>
    </>
  );
}
