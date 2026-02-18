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

type AnswerType = 'yes_no' | 'text' | 'textarea' | 'multiple_choice';

interface Question {
  id: string;
  questionText: string;
  questionOrder: number;
  answerType: AnswerType;
  options: string[] | null;
  placeholder: string | null;
  isRequired: boolean;
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
  sections = [],
  pixelConfig,
  funnelPageId,
  fontFamily,
  fontUrl,
}: ThankyouPageProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentTextValue, setCurrentTextValue] = useState('');
  const [qualificationComplete, setQualificationComplete] = useState(questions.length === 0);
  const [isQualified, setIsQualified] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookingRef = useRef<HTMLDivElement>(null);

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
        const response = await fetch('/api/public/lead', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, answers: finalAnswers }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit answers');
        }

        setIsQualified(data.isQualified);
      }
      setQualificationComplete(true);
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

  // If no questions, determine qualification (default to qualified)
  useEffect(() => {
    if (questions.length === 0) {
      setIsQualified(true);
    }
  }, [questions.length]);

  // Auto-scroll to booking embed after survey completion
  useEffect(() => {
    if (qualificationComplete && isQualified && calendlyUrl && bookingRef.current) {
      // Small delay to let the DOM render the booking section
      const timer = setTimeout(() => {
        bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [qualificationComplete, isQualified, calendlyUrl]);

  // Track thank-you page view
  useEffect(() => {
    if (funnelPageId) {
      fetch('/api/public/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId, pageType: 'thankyou' }),
      }).catch(() => {});
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
            You&apos;re in! Check your inbox for your resource.
          </p>
        </div>

        {/* 2. Logo */}
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-12 w-auto mx-auto"
          />
        )}

        {/* 3. Value headline + subline (selling the survey) */}
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

        {/* 4. Above-video sections (social proof) */}
        {aboveSections.length > 0 && (
          <div className="space-y-6">
            {aboveSections.map(s => <SectionRenderer key={s.id} section={s} />)}
          </div>
        )}

        {/* 5. Video (sells filling in the survey) */}
        {vslUrl && (
          <VideoEmbed url={vslUrl} />
        )}

        {/* 6. Survey card - visually prominent */}
        {hasQuestions && !qualificationComplete && (
          <div className="relative">
            {/* Background glow */}
            <div
              className="absolute -inset-3 rounded-2xl blur-xl opacity-30 pointer-events-none"
              style={{ background: primaryColor }}
            />
            <div
              className="relative rounded-xl p-6 md:p-8 space-y-6"
              style={{
                background: 'var(--ds-card)',
                border: `2px solid color-mix(in srgb, ${primaryColor} 40%, transparent)`,
                boxShadow: `0 0 30px color-mix(in srgb, ${primaryColor} 15%, transparent)`,
              }}
            >
              {/* Quick Survey pill */}
              <div className="flex justify-center -mt-10 md:-mt-12 mb-2">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ background: primaryColor }}
                >
                  Quick Survey
                </span>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--ds-placeholder)' }}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
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
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">{error}</p>
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
                        className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-red-400"
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
                        className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-red-400"
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
        )}

        {/* 7. Qualification Result */}
        {qualificationComplete && isQualified !== null && (
          <div
            className={`rounded-xl p-6 text-center ${
              isQualified
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-400/10 border border-red-400/30'
            }`}
          >
            {isQualified ? (
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 mx-auto mb-3 text-red-400" />
            )}
            <p className={`font-medium ${isQualified ? 'text-green-500' : 'text-red-400'}`}>
              {isQualified ? passMessage : failMessage}
            </p>
          </div>
        )}

        {/* 8. Below-video sections */}
        {belowSections.length > 0 && (
          <div className="space-y-6">
            {belowSections.map(s => <SectionRenderer key={s.id} section={s} />)}
          </div>
        )}
      </div>

      {/* 9. Cal.com booking embed - wider container for desktop mode */}
      {qualificationComplete && isQualified && calendlyUrl && (
        <div ref={bookingRef} className="w-full max-w-5xl px-4 mt-8 space-y-4">
          <h3
            className="text-lg font-semibold text-center"
            style={{ color: 'var(--ds-text)' }}
          >
            Book Your Call
          </h3>
          <CalendlyEmbed url={calendlyUrl} />
        </div>
      )}

      {/* 11. Powered by */}
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
    </div>
    </>
  );
}
