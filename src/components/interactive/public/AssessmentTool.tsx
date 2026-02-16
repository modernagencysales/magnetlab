'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import type { AssessmentConfig, AssessmentQuestion, ScoreRange } from '@/lib/types/lead-magnet';

interface AssessmentToolProps {
  config: AssessmentConfig;
  theme: 'dark' | 'light';
  primaryColor: string;
}

const LETTER_BADGES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function findScoreRange(score: number, ranges: ScoreRange[]): ScoreRange | null {
  return ranges.find((r) => score >= r.min && score <= r.max) || null;
}

export function AssessmentTool({ config, theme, primaryColor }: AssessmentToolProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [multipleChoiceSelections, setMultipleChoiceSelections] = useState<Record<string, Set<number>>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const totalQuestions = config.questions.length;
  const currentQuestion: AssessmentQuestion | undefined = config.questions[currentQuestionIndex];
  const progress = isComplete ? 100 : (currentQuestionIndex / totalQuestions) * 100;

  const containerClasses = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const mutedTextClasses = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardClasses = isDark
    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
    : 'bg-gray-50 border-gray-200 hover:bg-gray-100';

  const transitionToQuestion = useCallback((direction: 'next' | 'prev', targetIndex?: number) => {
    setIsTransitioning(true);
    setIsVisible(false);

    setTimeout(() => {
      if (direction === 'next' && targetIndex !== undefined) {
        if (targetIndex >= totalQuestions) {
          setIsComplete(true);
        } else {
          setCurrentQuestionIndex(targetIndex);
        }
      } else if (direction === 'prev') {
        setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
      }
      setIsVisible(true);
      setIsTransitioning(false);
    }, 200);
  }, [totalQuestions]);

  const handleSingleChoice = useCallback((questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Auto-advance after short delay
    setTimeout(() => {
      transitionToQuestion('next', currentQuestionIndex + 1);
    }, 300);
  }, [currentQuestionIndex, transitionToQuestion]);

  const handleMultipleChoiceToggle = useCallback((questionId: string, value: number) => {
    setMultipleChoiceSelections((prev) => {
      const current = new Set(prev[questionId] || []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return { ...prev, [questionId]: current };
    });
  }, []);

  const handleMultipleChoiceNext = useCallback((questionId: string) => {
    const selections = multipleChoiceSelections[questionId];
    if (selections && selections.size > 0) {
      let sum = 0;
      selections.forEach((v) => { sum += v; });
      setAnswers((prev) => ({ ...prev, [questionId]: sum }));
    } else {
      setAnswers((prev) => ({ ...prev, [questionId]: 0 }));
    }
    transitionToQuestion('next', currentQuestionIndex + 1);
  }, [currentQuestionIndex, multipleChoiceSelections, transitionToQuestion]);

  const handleScale = useCallback((questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Auto-advance after short delay
    setTimeout(() => {
      transitionToQuestion('next', currentQuestionIndex + 1);
    }, 300);
  }, [currentQuestionIndex, transitionToQuestion]);

  const handleBack = useCallback(() => {
    if (currentQuestionIndex > 0) {
      transitionToQuestion('prev');
    }
  }, [currentQuestionIndex, transitionToQuestion]);

  const handleRetake = useCallback(() => {
    setIsTransitioning(true);
    setIsVisible(false);
    setTimeout(() => {
      setCurrentQuestionIndex(0);
      setAnswers({});
      setMultipleChoiceSelections({});
      setIsComplete(false);
      setIsVisible(true);
      setIsTransitioning(false);
    }, 200);
  }, []);

  // Keyboard support
  useEffect(() => {
    if (isComplete || !currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentQuestion.type === 'scale') {
        const scaleMin = currentQuestion.scaleMin ?? 1;
        const scaleMax = currentQuestion.scaleMax ?? 5;
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= scaleMin && num <= scaleMax) {
          handleScale(currentQuestion.id, num);
        }
      }

      if (currentQuestion.type === 'single_choice' && currentQuestion.options) {
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= currentQuestion.options.length) {
          handleSingleChoice(currentQuestion.id, currentQuestion.options[num - 1].value);
        }
      }

      if (currentQuestion.type === 'multiple_choice' && e.key === 'Enter') {
        handleMultipleChoiceNext(currentQuestion.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isComplete, currentQuestion, handleScale, handleSingleChoice, handleMultipleChoiceNext]);

  // Calculate score for results
  const totalScore = Object.values(answers).reduce((sum, val) => sum + val, 0);
  const averageScore = totalQuestions > 0 ? totalScore / totalQuestions : 0;
  const finalScore = config.scoring.method === 'average' ? averageScore : totalScore;
  const matchedRange = findScoreRange(finalScore, config.scoring.ranges);

  // Render results screen
  if (isComplete) {
    return (
      <div className={`rounded-2xl p-6 md:p-8 ${containerClasses}`} ref={containerRef}>
        {/* Progress bar (100%) */}
        <div className="mb-8">
          <div className={`h-2 w-full rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: '100%', backgroundColor: primaryColor }}
            />
          </div>
        </div>

        <div
          className={`transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Score display */}
          <div className="text-center mb-8">
            <div className={`text-sm font-semibold uppercase tracking-wider mb-2 ${mutedTextClasses}`}>
              Your Score
            </div>
            <div
              className="text-5xl md:text-6xl font-bold mb-4"
              style={{ color: primaryColor }}
            >
              {config.scoring.method === 'average' ? finalScore.toFixed(1) : finalScore}
            </div>
            {matchedRange && (
              <>
                <span
                  className="inline-block rounded-full px-5 py-2 text-base font-bold text-white mb-4"
                  style={{ backgroundColor: primaryColor }}
                >
                  {matchedRange.label}
                </span>
                <p className={`text-base md:text-lg max-w-lg mx-auto ${mutedTextClasses}`}>
                  {matchedRange.description}
                </p>
              </>
            )}
          </div>

          {/* Recommendations */}
          {matchedRange && matchedRange.recommendations.length > 0 && (
            <div
              className={`rounded-xl border p-5 md:p-6 mb-6 ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <h3 className="font-bold text-lg mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {matchedRange.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className={`text-sm md:text-base ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {rec}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Retake button */}
          <div className="text-center">
            <button
              onClick={handleRetake}
              className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <RotateCcw className="h-4 w-4" />
              Retake Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const currentMCSelections = multipleChoiceSelections[currentQuestion.id] || new Set<number>();

  return (
    <div className={`rounded-2xl p-6 md:p-8 ${containerClasses}`} ref={containerRef}>
      {/* Progress bar */}
      <div className="mb-2">
        <div className={`h-2 w-full rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, backgroundColor: primaryColor }}
          />
        </div>
      </div>

      {/* Question counter + back button */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleBack}
          disabled={currentQuestionIndex === 0 || isTransitioning}
          className={`inline-flex items-center gap-1 text-sm font-medium transition-opacity ${
            currentQuestionIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } ${mutedTextClasses} hover:opacity-80`}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className={`text-sm font-medium ${mutedTextClasses}`}>
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </span>
      </div>

      {/* Question content with transition */}
      <div
        className={`transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Question text */}
        <h3 className="text-xl md:text-2xl font-bold mb-6 leading-tight">
          {currentQuestion.text}
        </h3>

        {/* Single choice */}
        {currentQuestion.type === 'single_choice' && currentQuestion.options && (
          <div className="space-y-3">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = answers[currentQuestion.id] === opt.value;
              return (
                <button
                  key={idx}
                  onClick={() => handleSingleChoice(currentQuestion.id, opt.value)}
                  disabled={isTransitioning}
                  className={`w-full flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all ${
                    isSelected
                      ? 'border-current shadow-md'
                      : `${cardClasses} border-transparent`
                  }`}
                  style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                      isSelected ? 'text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                    }`}
                    style={isSelected ? { backgroundColor: primaryColor } : undefined}
                  >
                    {LETTER_BADGES[idx]}
                  </span>
                  <span className="text-base font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Multiple choice */}
        {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
          <div>
            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = currentMCSelections.has(opt.value);
                return (
                  <button
                    key={idx}
                    onClick={() => handleMultipleChoiceToggle(currentQuestion.id, opt.value)}
                    disabled={isTransitioning}
                    className={`w-full flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all ${
                      isSelected
                        ? 'border-current shadow-md'
                        : `${cardClasses} border-transparent`
                    }`}
                    style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition-all ${
                        isSelected ? 'text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                      }`}
                      style={isSelected ? { backgroundColor: primaryColor } : undefined}
                    >
                      {isSelected ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        LETTER_BADGES[idx]
                      )}
                    </span>
                    <span className="text-base font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className={`text-sm mb-4 ${mutedTextClasses}`}>Select all that apply, then continue.</p>
            <button
              onClick={() => handleMultipleChoiceNext(currentQuestion.id)}
              disabled={isTransitioning}
              className="w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              Next
            </button>
          </div>
        )}

        {/* Scale */}
        {currentQuestion.type === 'scale' && (() => {
          const scaleMin = currentQuestion.scaleMin ?? 1;
          const scaleMax = currentQuestion.scaleMax ?? 5;
          const scaleValues = Array.from(
            { length: scaleMax - scaleMin + 1 },
            (_, i) => scaleMin + i
          );
          const selectedValue = answers[currentQuestion.id];

          return (
            <div>
              {/* Scale labels */}
              {currentQuestion.scaleLabels && (
                <div className={`flex justify-between text-sm mb-3 ${mutedTextClasses}`}>
                  <span>{currentQuestion.scaleLabels.min}</span>
                  <span>{currentQuestion.scaleLabels.max}</span>
                </div>
              )}
              {/* Scale buttons */}
              <div className="flex gap-2 md:gap-3">
                {scaleValues.map((val) => {
                  const isSelected = selectedValue === val;
                  return (
                    <button
                      key={val}
                      onClick={() => handleScale(currentQuestion.id, val)}
                      disabled={isTransitioning}
                      className={`flex-1 aspect-square max-w-[64px] flex items-center justify-center rounded-xl border-2 text-lg md:text-xl font-bold transition-all ${
                        isSelected
                          ? 'text-white shadow-md'
                          : isDark
                            ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: primaryColor, borderColor: primaryColor }
                          : undefined
                      }
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
