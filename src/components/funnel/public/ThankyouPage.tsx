'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { VideoEmbed } from './VideoEmbed';
import { CalendlyEmbed } from './CalendlyEmbed';

interface Question {
  id: string;
  questionText: string;
  questionOrder: number;
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
}: ThankyouPageProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({});
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

  const handleAnswer = async (answer: 'yes' | 'no') => {
    if (!currentQuestion) return;

    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    setError(null);

    if (currentQuestionIndex < questions.length - 1) {
      // More questions to go
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // All questions answered, submit
      setSubmitting(true);

      try {
        if (leadId) {
          const response = await fetch('/api/public/lead', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId, answers: newAnswers }),
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
    }
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

                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnswer('yes')}
                    className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-green-500"
                    style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleAnswer('no')}
                    className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:border-red-400"
                    style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textColor }}
                  >
                    No
                  </button>
                </div>
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
