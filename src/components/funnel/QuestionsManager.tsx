'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, Loader2, HelpCircle, ListChecks, X, ChevronDown } from 'lucide-react';
import type { QualificationQuestion, AnswerType } from '@/lib/types/funnel';
import { SURVEY_TEMPLATE_QUESTIONS } from '@/lib/constants/survey-templates';

interface QuestionsManagerProps {
  funnelId: string | null;
  formId?: string | null;
  questions: QualificationQuestion[];
  setQuestions: (questions: QualificationQuestion[]) => void;
  onNeedsSave: () => void;
}

const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  yes_no: 'Yes / No',
  text: 'Short Text',
  textarea: 'Long Text',
  multiple_choice: 'Multiple Choice',
};

export function QuestionsManager({
  funnelId,
  formId,
  questions,
  setQuestions,
  onNeedsSave,
}: QuestionsManagerProps) {
  // Determine API base path: form-based or legacy funnel-based
  const apiBase = formId
    ? `/api/qualification-forms/${formId}/questions`
    : funnelId
      ? `/api/funnel/${funnelId}/questions`
      : null;
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswerType, setNewAnswerType] = useState<AnswerType>('yes_no');
  const [newQualifyingAnswer, setNewQualifyingAnswer] = useState<string>('yes');
  const [newOptions, setNewOptions] = useState<string[]>(['', '']);
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newIsQualifying, setNewIsQualifying] = useState(true);
  const [newIsRequired, setNewIsRequired] = useState(true);
  const [newQualifyingOptions, setNewQualifyingOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const resetNewForm = () => {
    setNewQuestion('');
    setNewAnswerType('yes_no');
    setNewQualifyingAnswer('yes');
    setNewOptions(['', '']);
    setNewPlaceholder('');
    setNewIsQualifying(true);
    setNewIsRequired(true);
    setNewQualifyingOptions([]);
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return;

    if (!apiBase) {
      onNeedsSave();
      setError('Please save the funnel first before adding questions.');
      return;
    }

    if (newAnswerType === 'multiple_choice') {
      const validOptions = newOptions.filter(o => o.trim());
      if (validOptions.length < 2) {
        setError('Multiple choice questions need at least 2 options.');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const validOptions = newOptions.filter(o => o.trim());
      const isQualifying = newIsQualifying && (newAnswerType === 'yes_no' || newAnswerType === 'multiple_choice');

      let qualifyingAnswer: string | string[] | null = null;
      if (isQualifying) {
        if (newAnswerType === 'yes_no') {
          qualifyingAnswer = newQualifyingAnswer;
        } else if (newAnswerType === 'multiple_choice') {
          qualifyingAnswer = newQualifyingOptions.length > 0 ? newQualifyingOptions : null;
        }
      }

      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: newQuestion.trim(),
          answerType: newAnswerType,
          qualifyingAnswer,
          options: newAnswerType === 'multiple_choice' ? validOptions : null,
          placeholder: (newAnswerType === 'text' || newAnswerType === 'textarea') ? newPlaceholder || null : null,
          isQualifying,
          isRequired: newIsRequired,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add question');
      }

      const { question } = await response.json();
      setQuestions([...questions, question]);
      resetNewForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuestion = async (questionId: string, updates: Record<string, unknown>) => {
    if (!apiBase) return;

    try {
      const response = await fetch(`${apiBase}/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      const { question: updated } = await response.json();
      setQuestions(questions.map(q => q.id === questionId ? updated : q));
    } catch {
      // Error handled silently - UI remains responsive
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!apiBase) return;

    try {
      const response = await fetch(`${apiBase}/${questionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      setQuestions(questions.filter(q => q.id !== questionId));
    } catch {
      // Error handled silently - UI remains responsive
    }
  };

  const handleLoadTemplate = async () => {
    if (!apiBase) {
      onNeedsSave();
      setError('Please save the funnel first before loading a template.');
      return;
    }

    setLoadingTemplate(true);
    setError(null);

    try {
      const newQuestions: QualificationQuestion[] = [];
      for (let i = 0; i < SURVEY_TEMPLATE_QUESTIONS.length; i++) {
        const tq = SURVEY_TEMPLATE_QUESTIONS[i];
        const response = await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionText: tq.questionText,
            answerType: tq.answerType,
            qualifyingAnswer: tq.qualifyingAnswer,
            options: tq.options,
            placeholder: tq.placeholder,
            isQualifying: tq.isQualifying,
            isRequired: tq.isRequired,
            questionOrder: questions.length + i,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create template question');
        }

        const { question } = await response.json();
        newQuestions.push(question);
      }
      setQuestions([...questions, ...newQuestions]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    dragCounter.current++;
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDrop = async (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex || !apiBase) {
      handleDragEnd();
      return;
    }

    const newQuestions = [...questions];
    const [removed] = newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(targetIndex, 0, removed);
    setQuestions(newQuestions);
    handleDragEnd();

    try {
      const response = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: newQuestions.map(q => q.id),
        }),
      });

      if (!response.ok) {
        setQuestions(questions);
      }
    } catch {
      setQuestions(questions);
    }
  };

  const getAnswerTypeLabel = (type: AnswerType) => ANSWER_TYPE_LABELS[type] || type;

  const getQualifyingLabel = (q: QualificationQuestion) => {
    if (!q.isQualifying) return null;
    if (q.answerType === 'yes_no') {
      return `Qualifies on: ${q.qualifyingAnswer}`;
    }
    if (q.answerType === 'multiple_choice' && Array.isArray(q.qualifyingAnswer)) {
      return `Qualifies on: ${q.qualifyingAnswer.join(', ')}`;
    }
    return 'Qualifying';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Survey Questions
          </h3>
          <p className="text-sm text-muted-foreground">
            Add questions to qualify leads and collect data. Qualifying questions determine if a lead sees your Calendly.
          </p>
        </div>
        {questions.length < SURVEY_TEMPLATE_QUESTIONS.length && (
          <button
            onClick={handleLoadTemplate}
            disabled={loadingTemplate}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50 shrink-0"
          >
            {loadingTemplate ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ListChecks className="h-4 w-4" />
            )}
            Load Template
          </button>
        )}
      </div>

      {formId && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            These questions come from a shared form. Edits here will apply to all funnels using this form.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Existing Questions */}
      <div className="space-y-3">
        {questions.map((question, index) => (
          <div
            key={question.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDrop(index)}
            className={`rounded-lg border bg-card p-4 transition-all ${
              draggedIndex === index ? 'opacity-50 scale-[0.98]' : ''
            } ${
              dragOverIndex === index ? 'border-primary border-2 shadow-lg' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-muted-foreground cursor-grab active:cursor-grabbing mt-0.5">
                <GripVertical className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    Q{index + 1}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                    {getAnswerTypeLabel(question.answerType)}
                  </span>
                  {question.isQualifying && (
                    <span className="text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                      Qualifying
                    </span>
                  )}
                  {!question.isRequired && (
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-sm truncate">{question.questionText}</p>
                {question.isQualifying && (
                  <p className="text-xs text-muted-foreground mt-1">{getQualifyingLabel(question)}</p>
                )}
                {question.answerType === 'multiple_choice' && question.options && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Options: {question.options.join(' | ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedQuestion === question.id ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={() => handleDeleteQuestion(question.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Expanded edit view */}
            {expandedQuestion === question.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Question Text</label>
                  <input
                    type="text"
                    value={question.questionText}
                    onChange={(e) => handleUpdateQuestion(question.id, { questionText: e.target.value })}
                    className="w-full rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Answer Type</label>
                    <select
                      value={question.answerType}
                      onChange={(e) => handleUpdateQuestion(question.id, { answerType: e.target.value })}
                      className="w-full rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    >
                      {Object.entries(ANSWER_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={question.isQualifying}
                        onChange={(e) => handleUpdateQuestion(question.id, { isQualifying: e.target.checked })}
                        className="rounded border-border"
                        disabled={question.answerType === 'text' || question.answerType === 'textarea'}
                      />
                      Qualifying
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={question.isRequired}
                        onChange={(e) => handleUpdateQuestion(question.id, { isRequired: e.target.checked })}
                        className="rounded border-border"
                      />
                      Required
                    </label>
                  </div>
                </div>

                {(question.answerType === 'text' || question.answerType === 'textarea') && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={question.placeholder || ''}
                      onChange={(e) => handleUpdateQuestion(question.id, { placeholder: e.target.value || null })}
                      className="w-full rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      placeholder="e.g. Enter your answer..."
                    />
                  </div>
                )}

                {question.answerType === 'yes_no' && question.isQualifying && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Qualifying Answer</label>
                    <div className="flex gap-2">
                      {['yes', 'no'].map(val => (
                        <button
                          key={val}
                          onClick={() => handleUpdateQuestion(question.id, { qualifyingAnswer: val })}
                          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                            question.qualifyingAnswer === val
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {question.answerType === 'multiple_choice' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Options {question.isQualifying && '(check qualifying options)'}
                    </label>
                    <div className="space-y-2">
                      {(question.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          {question.isQualifying && (
                            <input
                              type="checkbox"
                              checked={Array.isArray(question.qualifyingAnswer) && question.qualifyingAnswer.includes(opt)}
                              onChange={(e) => {
                                const current = Array.isArray(question.qualifyingAnswer) ? [...question.qualifyingAnswer] : [];
                                if (e.target.checked) {
                                  current.push(opt);
                                } else {
                                  const idx = current.indexOf(opt);
                                  if (idx >= 0) current.splice(idx, 1);
                                }
                                handleUpdateQuestion(question.id, { qualifyingAnswer: current });
                              }}
                              className="rounded border-border"
                            />
                          )}
                          <span className="text-sm">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Question */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">New Question</label>
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            placeholder="Enter your question..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Answer Type</label>
            <select
              value={newAnswerType}
              onChange={(e) => {
                const type = e.target.value as AnswerType;
                setNewAnswerType(type);
                // Reset qualifying for text/textarea
                if (type === 'text' || type === 'textarea') {
                  setNewIsQualifying(false);
                } else {
                  setNewIsQualifying(true);
                }
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.entries(ANSWER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newIsQualifying}
                onChange={(e) => setNewIsQualifying(e.target.checked)}
                className="rounded border-border"
                disabled={newAnswerType === 'text' || newAnswerType === 'textarea'}
              />
              Qualifying
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newIsRequired}
                onChange={(e) => setNewIsRequired(e.target.checked)}
                className="rounded border-border"
              />
              Required
            </label>
          </div>
        </div>

        {/* Placeholder for text/textarea */}
        {(newAnswerType === 'text' || newAnswerType === 'textarea') && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Placeholder (optional)</label>
            <input
              type="text"
              value={newPlaceholder}
              onChange={(e) => setNewPlaceholder(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Enter your answer..."
            />
          </div>
        )}

        {/* Yes/No qualifying answer */}
        {newAnswerType === 'yes_no' && newIsQualifying && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Qualifying Answer</label>
            <div className="flex gap-2">
              {['yes', 'no'].map(val => (
                <button
                  key={val}
                  onClick={() => setNewQualifyingAnswer(val)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    newQualifyingAnswer === val
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Multiple choice options */}
        {newAnswerType === 'multiple_choice' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Options {newIsQualifying && '(check qualifying options)'}
            </label>
            <div className="space-y-2">
              {newOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {newIsQualifying && (
                    <input
                      type="checkbox"
                      checked={newQualifyingOptions.includes(opt) && opt.trim() !== ''}
                      onChange={(e) => {
                        if (e.target.checked && opt.trim()) {
                          setNewQualifyingOptions([...newQualifyingOptions, opt]);
                        } else {
                          setNewQualifyingOptions(newQualifyingOptions.filter(o => o !== opt));
                        }
                      }}
                      className="rounded border-border"
                      disabled={!opt.trim()}
                    />
                  )}
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const updated = [...newOptions];
                      const oldVal = updated[idx];
                      updated[idx] = e.target.value;
                      setNewOptions(updated);
                      // Update qualifying options if the value changed
                      if (newQualifyingOptions.includes(oldVal)) {
                        setNewQualifyingOptions(newQualifyingOptions.map(o => o === oldVal ? e.target.value : o));
                      }
                    }}
                    className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder={`Option ${idx + 1}`}
                  />
                  {newOptions.length > 2 && (
                    <button
                      onClick={() => {
                        setNewOptions(newOptions.filter((_, i) => i !== idx));
                        setNewQualifyingOptions(newQualifyingOptions.filter(o => o !== opt));
                      }}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setNewOptions([...newOptions, ''])}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                + Add option
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleAddQuestion}
            disabled={!newQuestion.trim() || saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Question
          </button>
        </div>
      </div>

      {questions.length === 0 && (
        <div className="text-center py-8 space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            <HelpCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No survey questions yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Add questions to qualify leads and collect data. Use the template to get started quickly.
            </p>
          </div>
        </div>
      )}

      {/* Reorder hint */}
      {questions.length > 1 && (
        <p className="text-xs text-muted-foreground text-center">
          Drag questions to reorder them
        </p>
      )}
    </div>
  );
}
