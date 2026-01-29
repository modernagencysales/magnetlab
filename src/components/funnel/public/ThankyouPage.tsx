'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { VideoEmbed } from './VideoEmbed';
import { CalendlyEmbed } from './CalendlyEmbed';

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
  leadMagnetTitle,
}: ThankyouPageProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentTextValue, setCurrentTextValue] = useState('');
  const [qualificationComplete, setQualificationComplete] = useState(questions.length === 0);
  const [isQualified, setIsQualified] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme-based colors
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#09090B' : '#FAFAFA';
  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const mutedColor = isDark ? '#A1A1AA' : '#71717A';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const cardBg = isDark ? '#18181B' : '#FFFFFF';
  const placeholderColor = isDark ? '#71717A' : '#A1A1AA';

  // Background style
  const getBackgroundStyle = () => {
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
  };

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
      console.error('Error submitting qualification:', err);
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

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-12"
      style={{ background: getBackgroundStyle() }}
    >
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          {/* Logo */}
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-12 w-auto mx-auto mb-4"
            />
          )}

          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: cardBg }}
          >
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>

          <h1
            className="text-2xl md:text-3xl font-semibold"
            style={{ color: textColor }}
          >
            {headline}
          </h1>

          {subline && (
            <p style={{ color: mutedColor }}>
              {subline}
            </p>
          )}
        </div>

        {/* Content page link */}
        {contentPageUrl && (
          <div className="text-center">
            <a
              href={leadId ? `${contentPageUrl}?leadId=${leadId}` : contentPageUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                background: primaryColor,
                color: '#FFFFFF',
                fontWeight: 500,
                fontSize: '1rem',
                textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Access Your {leadMagnetTitle || 'Content'}
            </a>
          </div>
        )}

        {/* Video (show immediately to everyone) */}
        {vslUrl && (
          <VideoEmbed url={vslUrl} />
        )}

        {/* Qualification Questions */}
        {hasQuestions && !qualificationComplete && (
          <div
            className="rounded-xl p-6 space-y-6"
            style={{ background: cardBg, border: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: placeholderColor }}>
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: i <= currentQuestionIndex ? primaryColor : borderColor
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
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: primaryColor }} />
              </div>
            ) : (
              <>
                <p className="text-lg font-medium" style={{ color: textColor }}>
                  {currentQuestion?.questionText}
                </p>

                {/* Yes/No buttons */}
                {currentQuestion?.answerType === 'yes_no' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleYesNoAnswer('yes')}
                      className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-green-500"
                      style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleYesNoAnswer('no')}
                      className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-red-400"
                      style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
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
                      style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      {!currentQuestion.isRequired && (
                        <button
                          onClick={handleSkip}
                          className="text-sm transition-colors"
                          style={{ color: placeholderColor }}
                        >
                          Skip
                        </button>
                      )}
                      <button
                        onClick={handleTextSubmit}
                        className="ml-auto rounded-lg px-6 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                        style={{ background: primaryColor, color: '#FFFFFF' }}
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
                      style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      {!currentQuestion.isRequired && (
                        <button
                          onClick={handleSkip}
                          className="text-sm transition-colors"
                          style={{ color: placeholderColor }}
                        >
                          Skip
                        </button>
                      )}
                      <button
                        onClick={handleTextSubmit}
                        className="ml-auto rounded-lg px-6 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                        style={{ background: primaryColor, color: '#FFFFFF' }}
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
                          style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = primaryColor)}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = borderColor)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {!currentQuestion.isRequired && (
                      <button
                        onClick={handleSkip}
                        className="text-sm transition-colors"
                        style={{ color: placeholderColor }}
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
                      style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleYesNoAnswer('no')}
                      className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-red-400"
                      style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                    >
                      No
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Qualification Result */}
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

        {/* Calendly (show only for qualified leads) */}
        {qualificationComplete && isQualified && calendlyUrl && (
          <div className="space-y-4">
            <h3
              className="text-lg font-semibold text-center"
              style={{ color: textColor }}
            >
              Book Your Call
            </h3>
            <CalendlyEmbed url={calendlyUrl} />
          </div>
        )}
      </div>

      {/* Powered by */}
      <div className="mt-12">
        <a
          href="https://magnetlab.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors hover:opacity-80"
          style={{ color: placeholderColor }}
        >
          Powered by MagnetLab
        </a>
      </div>
    </div>
  );
}
