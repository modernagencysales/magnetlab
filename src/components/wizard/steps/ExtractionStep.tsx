'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Send } from 'lucide-react';
import type { LeadMagnetConcept, ContentExtractionQuestion, LeadMagnetArchetype } from '@/lib/types/lead-magnet';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';

interface ExtractionStepProps {
  concept: LeadMagnetConcept;
  initialAnswers: Record<string, string>;
  onComplete: (answers: Record<string, string>, archetype: LeadMagnetArchetype, concept: LeadMagnetConcept) => void;
  onBack: () => void;
  loading: boolean;
}

export function ExtractionStep({
  concept,
  initialAnswers,
  onComplete,
  onBack,
  loading,
}: ExtractionStepProps) {
  const [questions, setQuestions] = useState<ContentExtractionQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const response = await fetch(
          `/api/lead-magnet/extract?archetype=${concept.archetype}`
        );
        const data = await response.json();
        setQuestions(data.questions);
      } catch (error) {
        console.error('Failed to fetch questions:', error);
      } finally {
        setLoadingQuestions(false);
      }
    }

    fetchQuestions();
  }, [concept.archetype]);

  const currentQuestion = questions[currentQuestionIndex];
  const isComplete = Object.keys(answers).length >= questions.filter((q) => q.required).length;

  const handleAnswerSubmit = () => {
    const answer = answers[currentQuestion?.id];
    if (!answer?.trim()) return;

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleComplete = () => {
    onComplete(answers, concept.archetype, concept);
  };

  if (loadingQuestions) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 text-sm font-medium text-primary">
            {ARCHETYPE_NAMES[concept.archetype]}
          </div>
          <h1 className="text-3xl font-bold">{concept.title}</h1>
          <p className="mt-2 text-muted-foreground">
            Let&apos;s extract your unique expertise. Answer these questions to create genuinely valuable content.
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {currentQuestionIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Question cards */}
      <div className="space-y-4">
        {questions.map((question, index) => {
          const isActive = index === currentQuestionIndex;
          const isAnswered = !!answers[question.id];

          if (index > currentQuestionIndex && !isAnswered) {
            return null;
          }

          return (
            <div
              key={question.id}
              className={`rounded-xl border p-5 transition-all ${
                isActive ? 'border-primary bg-card shadow-lg' : 'bg-muted/30'
              }`}
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{question.question}</p>
                  {question.context && (
                    <p className="mt-1 text-sm text-muted-foreground">{question.context}</p>
                  )}
                </div>
              </div>

              <textarea
                value={answers[question.id] || ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                }
                placeholder={isActive ? 'Type your answer here...' : ''}
                rows={isActive ? 4 : 2}
                disabled={!isActive}
                className="w-full resize-none rounded-lg border bg-background px-4 py-3 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleAnswerSubmit();
                  }
                }}
              />

              {isActive && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {question.required ? 'Required' : 'Optional'} · Press Cmd+Enter to continue
                  </span>
                  <button
                    onClick={handleAnswerSubmit}
                    disabled={!answers[question.id]?.trim()}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {index < questions.length - 1 ? 'Next' : 'Done'}
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion button */}
      {isComplete && (
        <button
          onClick={handleComplete}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating your lead magnet...
            </>
          ) : (
            <>
              <MessageCircle className="h-5 w-5" />
              Generate Lead Magnet Content
            </>
          )}
        </button>
      )}
    </div>
  );
}
