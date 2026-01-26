'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import type { QualificationQuestion, QualifyingAnswer } from '@/lib/types/funnel';

interface QuestionsManagerProps {
  funnelId: string | null;
  questions: QualificationQuestion[];
  setQuestions: (questions: QualificationQuestion[]) => void;
  onNeedsSave: () => void;
}

export function QuestionsManager({
  funnelId,
  questions,
  setQuestions,
  onNeedsSave,
}: QuestionsManagerProps) {
  const [newQuestion, setNewQuestion] = useState('');
  const [newQualifyingAnswer, setNewQualifyingAnswer] = useState<QualifyingAnswer>('yes');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return;

    if (!funnelId) {
      onNeedsSave();
      setError('Please save the funnel first before adding questions.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/funnel/${funnelId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: newQuestion.trim(),
          qualifyingAnswer: newQualifyingAnswer,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add question');
      }

      const { question } = await response.json();
      setQuestions([...questions, question]);
      setNewQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuestion = async (questionId: string, updates: Partial<{ questionText: string; qualifyingAnswer: QualifyingAnswer }>) => {
    if (!funnelId) return;

    try {
      const response = await fetch(`/api/funnel/${funnelId}/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      const { question: updated } = await response.json();
      setQuestions(questions.map(q => q.id === questionId ? updated : q));
    } catch (err) {
      console.error('Update question error:', err);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!funnelId) return;

    try {
      const response = await fetch(`/api/funnel/${funnelId}/questions/${questionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      setQuestions(questions.filter(q => q.id !== questionId));
    } catch (err) {
      console.error('Delete question error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Qualification Questions
        </h3>
        <p className="text-sm text-muted-foreground">
          Add yes/no questions to qualify leads. Only leads who answer correctly will see your Calendly booking widget.
        </p>
      </div>

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
            className="rounded-lg border bg-card p-4 flex items-start gap-3"
          >
            <div className="text-muted-foreground cursor-move">
              <GripVertical className="h-5 w-5" />
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Q{index + 1}</span>
                <input
                  type="text"
                  value={question.questionText}
                  onChange={(e) => handleUpdateQuestion(question.id, { questionText: e.target.value })}
                  className="flex-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">Qualifying answer:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateQuestion(question.id, { qualifyingAnswer: 'yes' })}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      question.qualifyingAnswer === 'yes'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleUpdateQuestion(question.id, { qualifyingAnswer: 'no' })}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      question.qualifyingAnswer === 'no'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDeleteQuestion(question.id)}
              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
            placeholder="Do you have a team of at least 5 people?"
            onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Qualifying answer:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setNewQualifyingAnswer('yes')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  newQualifyingAnswer === 'yes'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setNewQualifyingAnswer('no')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  newQualifyingAnswer === 'no'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                No
              </button>
            </div>
          </div>

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
        <div className="text-center py-6 text-sm text-muted-foreground">
          No qualification questions yet. Add questions to filter your leads.
        </div>
      )}
    </div>
  );
}
