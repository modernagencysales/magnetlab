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
}: ThankyouPageProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({});
  const [qualificationComplete, setQualificationComplete] = useState(questions.length === 0);
  const [isQualified, setIsQualified] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const hasQuestions = questions.length > 0;

  const handleAnswer = async (answer: 'yes' | 'no') => {
    if (!currentQuestion) return;

    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

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

          if (response.ok) {
            const data = await response.json();
            setIsQualified(data.isQualified);
          }
        }
      } catch (err) {
        console.error('Error submitting qualification:', err);
      } finally {
        setQualificationComplete(true);
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
      style={{ background: '#09090B' }}
    >
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#18181B' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: '#22C55E' }} />
          </div>

          <h1
            className="text-2xl md:text-3xl font-semibold"
            style={{ color: '#FAFAFA' }}
          >
            {headline}
          </h1>

          {subline && (
            <p style={{ color: '#A1A1AA' }}>
              {subline}
            </p>
          )}
        </div>

        {/* Qualification Questions */}
        {hasQuestions && !qualificationComplete && (
          <div
            className="rounded-xl p-6 space-y-6"
            style={{ background: '#18181B', border: '1px solid #27272A' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: '#71717A' }}>
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: i <= currentQuestionIndex ? '#8B5CF6' : '#3F3F46',
                    }}
                  />
                ))}
              </div>
            </div>

            {submitting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#8B5CF6' }} />
              </div>
            ) : (
              <>
                <p
                  className="text-lg font-medium"
                  style={{ color: '#FAFAFA' }}
                >
                  {currentQuestion?.questionText}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnswer('yes')}
                    className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                    style={{
                      background: '#18181B',
                      border: '1px solid #27272A',
                      color: '#FAFAFA',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#22C55E';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#27272A';
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleAnswer('no')}
                    className="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                    style={{
                      background: '#18181B',
                      border: '1px solid #27272A',
                      color: '#FAFAFA',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#F87171';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#27272A';
                    }}
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
            className="rounded-xl p-6 text-center"
            style={{
              background: isQualified ? 'rgba(34, 197, 94, 0.1)' : 'rgba(248, 113, 113, 0.1)',
              border: `1px solid ${isQualified ? 'rgba(34, 197, 94, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
            }}
          >
            {isQualified ? (
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3" style={{ color: '#22C55E' }} />
            ) : (
              <XCircle className="w-8 h-8 mx-auto mb-3" style={{ color: '#F87171' }} />
            )}
            <p
              className="font-medium"
              style={{ color: isQualified ? '#22C55E' : '#F87171' }}
            >
              {isQualified ? passMessage : failMessage}
            </p>
          </div>
        )}

        {/* Video (show after qualification or if no questions) */}
        {qualificationComplete && vslUrl && (
          <VideoEmbed url={vslUrl} />
        )}

        {/* Calendly (show only for qualified leads) */}
        {qualificationComplete && isQualified && calendlyUrl && (
          <div className="space-y-4">
            <h3
              className="text-lg font-semibold text-center"
              style={{ color: '#FAFAFA' }}
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
          style={{ color: '#52525B' }}
        >
          Powered by MagnetLab
        </a>
      </div>
    </div>
  );
}
