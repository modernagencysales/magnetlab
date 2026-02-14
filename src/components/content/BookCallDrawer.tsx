'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { CalendlyEmbed } from '@/components/funnel/public/CalendlyEmbed';

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

interface BookCallDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  calendlyUrl: string;
  funnelPageId: string;
  leadId: string;
  isQualified: boolean | null;
  hasQuestions: boolean;
  isDark: boolean;
  primaryColor: string;
}

export function BookCallDrawer({
  isOpen,
  onClose,
  calendlyUrl,
  funnelPageId,
  leadId,
  isQualified: initialQualified,
  hasQuestions,
  isDark,
  primaryColor,
}: BookCallDrawerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentTextValue, setCurrentTextValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qualificationComplete, setQualificationComplete] = useState(false);
  const [isQualified, setIsQualified] = useState<boolean | null>(initialQualified);
  const [error, setError] = useState<string | null>(null);

  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const mutedColor = isDark ? '#A1A1AA' : '#71717A';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const cardBg = isDark ? '#18181B' : '#FFFFFF';
  const bgColor = isDark ? '#09090B' : '#FAFAFA';

  const skipQualification = initialQualified === true || !hasQuestions;

  useEffect(() => {
    if (!isOpen || skipQualification) {
      if (skipQualification) setQualificationComplete(true);
      return;
    }

    setLoading(true);
    fetch(`/api/public/questions/${funnelPageId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        } else {
          setQualificationComplete(true);
          setIsQualified(true);
        }
      })
      .catch(() => {
        setQualificationComplete(true);
        setIsQualified(true);
      })
      .finally(() => setLoading(false));
  }, [isOpen, funnelPageId, skipQualification]);

  const currentQuestion = questions[currentQuestionIndex];

  const submitAllAnswers = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, answers: finalAnswers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit');
      setIsQualified(data.isQualified);
      setQualificationComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
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

  const handleAnswer = (answer: string) => {
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
    handleAnswer(currentTextValue.trim());
  };

  const handleSkip = () => {
    if (!currentQuestion) return;
    setError(null);
    setCurrentTextValue('');
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitAllAnswers(answers);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setCurrentQuestionIndex(0);
      setAnswers({});
      setCurrentTextValue('');
      setError(null);
      if (!skipQualification) {
        setQualificationComplete(false);
        setIsQualified(initialQualified);
      }
    }
  }, [isOpen, skipQualification, initialQualified]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 99,
        }}
      />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: bgColor,
          borderTop: `1px solid ${borderColor}`,
          borderRadius: '1rem 1rem 0 0',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>

        <div style={{ padding: '0.75rem 1.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div style={{ width: '2rem', height: '0.25rem', background: borderColor, borderRadius: '2px', margin: '0 auto' }} />
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: mutedColor, padding: '0.5rem', position: 'absolute', right: '1rem', top: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1rem 1.5rem 2rem', maxWidth: '600px', margin: '0 auto' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 size={24} style={{ color: primaryColor, animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!loading && !qualificationComplete && questions.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.875rem', color: mutedColor }}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: i <= currentQuestionIndex ? primaryColor : borderColor,
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
              )}

              {submitting ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader2 size={24} style={{ color: primaryColor, animation: 'spin 1s linear infinite' }} />
                </div>
              ) : currentQuestion && (
                <>
                  <p style={{ fontSize: '1.125rem', fontWeight: 500, color: textColor, marginBottom: '1rem' }}>
                    {currentQuestion.questionText}
                  </p>

                  {currentQuestion.answerType === 'yes_no' && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {['yes', 'no'].map((ans) => (
                        <button
                          key={ans}
                          onClick={() => handleAnswer(ans)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${borderColor}`,
                            background: cardBg,
                            color: textColor,
                            fontWeight: 500,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {ans}
                        </button>
                      ))}
                    </div>
                  )}

                  {(currentQuestion.answerType === 'text' || currentQuestion.answerType === 'textarea') && (
                    <div>
                      {currentQuestion.answerType === 'textarea' ? (
                        <textarea
                          value={currentTextValue}
                          onChange={(e) => setCurrentTextValue(e.target.value)}
                          placeholder={currentQuestion.placeholder || 'Type your answer...'}
                          rows={4}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${borderColor}`,
                            background: cardBg,
                            color: textColor,
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                          }}
                          autoFocus
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentTextValue}
                          onChange={(e) => setCurrentTextValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                          placeholder={currentQuestion.placeholder || 'Type your answer...'}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${borderColor}`,
                            background: cardBg,
                            color: textColor,
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                          }}
                          autoFocus
                        />
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                        {!currentQuestion.isRequired && (
                          <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.875rem' }}>
                            Skip
                          </button>
                        )}
                        <button
                          onClick={handleTextSubmit}
                          style={{
                            marginLeft: 'auto',
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.5rem',
                            background: primaryColor,
                            color: '#FFFFFF',
                            border: 'none',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {currentQuestion.answerType === 'multiple_choice' && currentQuestion.options && (
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {currentQuestion.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => handleAnswer(option)}
                            style={{
                              textAlign: 'left',
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              border: `1px solid ${borderColor}`,
                              background: cardBg,
                              color: textColor,
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {!currentQuestion.isRequired && (
                        <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.75rem' }}>
                          Skip
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {qualificationComplete && isQualified !== null && !isQualified && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <XCircle size={32} style={{ color: '#ef4444', margin: '0 auto 0.75rem' }} />
              <p style={{ color: '#ef4444', fontWeight: 500 }}>Thanks for your interest!</p>
            </div>
          )}

          {qualificationComplete && (isQualified === true || isQualified === null) && (
            <div>
              {isQualified === true && hasQuestions && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <CheckCircle2 size={32} style={{ color: '#22c55e', margin: '0 auto 0.75rem' }} />
                  <p style={{ color: '#22c55e', fontWeight: 500, marginBottom: '0.5rem' }}>You qualify! Book your call below.</p>
                </div>
              )}
              <CalendlyEmbed url={calendlyUrl} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
