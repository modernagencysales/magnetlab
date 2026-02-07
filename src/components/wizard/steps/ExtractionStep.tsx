'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Send, Lightbulb, Quote } from 'lucide-react';
import type { LeadMagnetConcept, ContentExtractionQuestion, LeadMagnetArchetype, IdeationSources } from '@/lib/types/lead-magnet';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';

interface ExtractionStepProps {
  concept: LeadMagnetConcept;
  initialAnswers: Record<string, string>;
  onComplete: (answers: Record<string, string>, archetype: LeadMagnetArchetype, concept: LeadMagnetConcept) => void;
  onBack: () => void;
  loading: boolean;
  ideationSources?: IdeationSources;
}

// Map of question IDs to relevant transcript insight types
const QUESTION_INSIGHT_MAPPING: Record<string, ('painPoints' | 'frequentQuestions' | 'transformationOutcomes' | 'objections' | 'languagePatterns')[]> = {
  // single-breakdown
  example: ['painPoints', 'transformationOutcomes'],
  walkthrough: ['languagePatterns'],
  psychology: ['objections', 'painPoints'],
  insight: ['frequentQuestions', 'painPoints'],
  adaptation: ['transformationOutcomes', 'objections'],
  // single-system
  outcome: ['transformationOutcomes'],
  steps: ['frequentQuestions'],
  pitfalls: ['objections', 'painPoints'],
  templates: ['languagePatterns'],
  results: ['transformationOutcomes'],
  differentiation: ['painPoints', 'objections'],
  // focused-toolkit
  useCase: ['painPoints', 'frequentQuestions'],
  items: ['languagePatterns'],
  content: ['languagePatterns'],
  context: ['frequentQuestions'],
  testing: ['transformationOutcomes'],
  exclusions: ['objections'],
  // single-calculator
  question: ['frequentQuestions', 'painPoints'],
  inputs: ['languagePatterns'],
  logic: ['objections'],
  output: ['transformationOutcomes'],
  interpretation: ['frequentQuestions'],
  limitations: ['objections'],
  // focused-directory
  need: ['painPoints', 'frequentQuestions'],
  dataPoints: ['languagePatterns'],
  experience: ['transformationOutcomes'],
  choosing: ['frequentQuestions', 'objections'],
  excluded: ['objections'],
  // mini-training
  skill: ['frequentQuestions', 'transformationOutcomes'],
  chunks: ['frequentQuestions'],
  teaching: ['languagePatterns', 'objections'],
  practice: ['transformationOutcomes'],
  mistakes: ['objections', 'painPoints'],
  beforeAfter: ['transformationOutcomes'],
  // one-story
  summary: ['transformationOutcomes'],
  before: ['painPoints'],
  journey: ['objections', 'frequentQuestions'],
  turningPoint: ['transformationOutcomes'],
  after: ['transformationOutcomes'],
  lessons: ['objections', 'painPoints'],
  // prompt
  task: ['painPoints', 'frequentQuestions'],
  prompt: ['languagePatterns'],
  examples: ['transformationOutcomes'],
  technique: ['objections'],
  tips: ['frequentQuestions'],
  // assessment
  evaluates: ['painPoints', 'frequentQuestions'],
  questions: ['frequentQuestions', 'objections'],
  scoring: ['languagePatterns'],
  ranges: ['transformationOutcomes'],
  actions: ['transformationOutcomes', 'objections'],
  benchmarks: ['transformationOutcomes'],
  // workflow
  purpose: ['painPoints', 'frequentQuestions'],
  setup: ['objections'],
  customization: ['frequentQuestions'],
  timeSaved: ['painPoints', 'transformationOutcomes'],
  troubleshooting: ['objections'],
};

export function ExtractionStep({
  concept,
  initialAnswers,
  onComplete,
  onBack,
  loading,
  ideationSources,
}: ExtractionStepProps) {
  const [questions, setQuestions] = useState<ContentExtractionQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Get transcript insights if available (used for contextual hints)
  const transcriptInsights = ideationSources?.callTranscript?.insights;

  // Get relevant insights for the current question
  const getRelevantInsights = (questionId: string) => {
    if (!transcriptInsights) return null;

    const insightTypes = QUESTION_INSIGHT_MAPPING[questionId];
    if (!insightTypes) return null;

    const relevantInsights: {
      painPoints?: typeof transcriptInsights.painPoints;
      frequentQuestions?: typeof transcriptInsights.frequentQuestions;
      transformationOutcomes?: typeof transcriptInsights.transformationOutcomes;
      objections?: typeof transcriptInsights.objections;
      languagePatterns?: string[];
    } = {};

    for (const type of insightTypes) {
      if (type === 'painPoints' && transcriptInsights.painPoints?.length) {
        relevantInsights.painPoints = transcriptInsights.painPoints.slice(0, 2);
      } else if (type === 'frequentQuestions' && transcriptInsights.frequentQuestions?.length) {
        relevantInsights.frequentQuestions = transcriptInsights.frequentQuestions.slice(0, 2);
      } else if (type === 'transformationOutcomes' && transcriptInsights.transformationOutcomes?.length) {
        relevantInsights.transformationOutcomes = transcriptInsights.transformationOutcomes.slice(0, 2);
      } else if (type === 'objections' && transcriptInsights.objections?.length) {
        relevantInsights.objections = transcriptInsights.objections.slice(0, 2);
      } else if (type === 'languagePatterns' && transcriptInsights.languagePatterns?.length) {
        relevantInsights.languagePatterns = transcriptInsights.languagePatterns.slice(0, 3);
      }
    }

    // Return null if no insights were found
    if (Object.keys(relevantInsights).length === 0) return null;

    return relevantInsights;
  };

  // Auto-scroll to current question when it changes
  useEffect(() => {
    if (currentQuestion && questionRefs.current[currentQuestion.id]) {
      // Small delay to allow the DOM to update
      setTimeout(() => {
        questionRefs.current[currentQuestion.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [currentQuestionIndex, currentQuestion]);

  const handleAnswerSubmit = () => {
    const answer = answers[currentQuestion?.id];
    if (!answer?.trim()) return;

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Last question - trigger completion
      handleComplete();
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
          <h1 className="text-3xl font-semibold">{concept.title}</h1>
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

          const relevantInsights = isActive ? getRelevantInsights(question.id) : null;

          return (
            <div
              key={question.id}
              ref={(el) => { questionRefs.current[question.id] = el; }}
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

              {/* Transcript insights panel - shown when available and question is active */}
              {isActive && relevantInsights && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                    <Lightbulb className="h-4 w-4" />
                    Insights from your coaching call
                  </div>
                  <div className="space-y-3 text-sm text-amber-900 dark:text-amber-100">
                    {relevantInsights.painPoints && relevantInsights.painPoints.length > 0 && (
                      <div>
                        <span className="font-medium">Pain points mentioned:</span>
                        <ul className="mt-1 space-y-1">
                          {relevantInsights.painPoints.map((p, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                              <span className="italic">&ldquo;{p.quote}&rdquo;</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {relevantInsights.frequentQuestions && relevantInsights.frequentQuestions.length > 0 && (
                      <div>
                        <span className="font-medium">Questions prospects ask:</span>
                        <ul className="mt-1 space-y-1">
                          {relevantInsights.frequentQuestions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="shrink-0">•</span>
                              <span>{q.question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {relevantInsights.transformationOutcomes && relevantInsights.transformationOutcomes.length > 0 && (
                      <div>
                        <span className="font-medium">Transformations desired:</span>
                        <ul className="mt-1 space-y-1">
                          {relevantInsights.transformationOutcomes.map((t, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="shrink-0">•</span>
                              <span>{t.currentState} → {t.desiredState}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {relevantInsights.objections && relevantInsights.objections.length > 0 && (
                      <div>
                        <span className="font-medium">Objections heard:</span>
                        <ul className="mt-1 space-y-1">
                          {relevantInsights.objections.map((o, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                              <span className="italic">&ldquo;{o.objection}&rdquo;</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {relevantInsights.languagePatterns && relevantInsights.languagePatterns.length > 0 && (
                      <div>
                        <span className="font-medium">Language to use:</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {relevantInsights.languagePatterns.map((pattern, i) => (
                            <span key={i} className="rounded-full bg-amber-200/50 px-2 py-0.5 text-xs dark:bg-amber-800/50">
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                    Use these real insights to inform your answer
                  </p>
                </div>
              )}

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
