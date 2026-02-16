'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { AssessmentConfig, AssessmentQuestion, ScoreRange } from '@/lib/types/lead-magnet';

interface AssessmentEditorProps {
  config: AssessmentConfig;
  onChange: (config: AssessmentConfig) => void;
}

export function AssessmentEditor({ config, onChange }: AssessmentEditorProps) {
  const update = (partial: Partial<AssessmentConfig>) => {
    onChange({ ...config, ...partial });
  };

  // Questions
  const updateQuestion = (index: number, partial: Partial<AssessmentQuestion>) => {
    const questions = [...config.questions];
    questions[index] = { ...questions[index], ...partial };
    update({ questions });
  };

  const addQuestion = () => {
    const newQuestion: AssessmentQuestion = {
      id: `q${config.questions.length + 1}`,
      text: '',
      type: 'single_choice',
      options: [
        { label: '', value: 1 },
        { label: '', value: 2 },
      ],
    };
    update({ questions: [...config.questions, newQuestion] });
  };

  const removeQuestion = (index: number) => {
    const questions = config.questions.filter((_, i) => i !== index);
    update({ questions });
  };

  const updateQuestionOption = (qIndex: number, optIndex: number, field: 'label' | 'value', val: string) => {
    const questions = [...config.questions];
    const options = [...(questions[qIndex].options || [])];
    options[optIndex] = { ...options[optIndex], [field]: field === 'value' ? Number(val) : val };
    questions[qIndex] = { ...questions[qIndex], options };
    update({ questions });
  };

  const addQuestionOption = (qIndex: number) => {
    const questions = [...config.questions];
    const options = [...(questions[qIndex].options || []), { label: '', value: 0 }];
    questions[qIndex] = { ...questions[qIndex], options };
    update({ questions });
  };

  const removeQuestionOption = (qIndex: number, optIndex: number) => {
    const questions = [...config.questions];
    const options = (questions[qIndex].options || []).filter((_, i) => i !== optIndex);
    questions[qIndex] = { ...questions[qIndex], options };
    update({ questions });
  };

  // Scoring
  const updateScoringMethod = (method: 'sum' | 'average') => {
    update({ scoring: { ...config.scoring, method } });
  };

  const updateRange = (index: number, partial: Partial<ScoreRange>) => {
    const ranges = [...config.scoring.ranges];
    ranges[index] = { ...ranges[index], ...partial };
    update({ scoring: { ...config.scoring, ranges } });
  };

  const addRange = () => {
    const newRange: ScoreRange = {
      min: 0,
      max: 100,
      label: '',
      description: '',
      recommendations: [],
    };
    update({ scoring: { ...config.scoring, ranges: [...config.scoring.ranges, newRange] } });
  };

  const removeRange = (index: number) => {
    const ranges = config.scoring.ranges.filter((_, i) => i !== index);
    update({ scoring: { ...config.scoring, ranges } });
  };

  const updateRangeRecommendations = (index: number, text: string) => {
    const recommendations = text
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);
    updateRange(index, { recommendations });
  };

  return (
    <div className="space-y-8">
      {/* Headline & Description */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basics</h3>
        <div>
          <label className="mb-1 block text-sm font-medium">Headline</label>
          <input
            type="text"
            value={config.headline}
            onChange={(e) => update({ headline: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={config.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Questions ({config.questions.length})
          </h3>
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
          >
            <Plus className="h-3 w-3" />
            Add Question
          </button>
        </div>

        {config.questions.map((question, qIndex) => (
          <div key={qIndex} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {qIndex + 1}
              </span>
              <button
                type="button"
                onClick={() => removeQuestion(qIndex)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Question Text</label>
              <input
                type="text"
                value={question.text}
                onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Type</label>
              <select
                value={question.type}
                onChange={(e) =>
                  updateQuestion(qIndex, { type: e.target.value as AssessmentQuestion['type'] })
                }
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="single_choice">Single Choice</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="scale">Scale</option>
              </select>
            </div>

            {/* Options for choice types */}
            {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Options</label>
                  <button
                    type="button"
                    onClick={() => addQuestionOption(qIndex)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add Option
                  </button>
                </div>
                {(question.options || []).map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateQuestionOption(qIndex, optIdx, 'label', e.target.value)}
                      placeholder="Label"
                      className="flex-1 rounded-lg border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="number"
                      value={opt.value}
                      onChange={(e) => updateQuestionOption(qIndex, optIdx, 'value', e.target.value)}
                      placeholder="Score"
                      className="w-16 rounded-lg border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeQuestionOption(qIndex, optIdx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Scale config */}
            {question.type === 'scale' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Min</label>
                  <input
                    type="number"
                    value={question.scaleMin ?? 1}
                    onChange={(e) => updateQuestion(qIndex, { scaleMin: Number(e.target.value) })}
                    className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Max</label>
                  <input
                    type="number"
                    value={question.scaleMax ?? 5}
                    onChange={(e) => updateQuestion(qIndex, { scaleMax: Number(e.target.value) })}
                    className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Scoring */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scoring</h3>

        <div>
          <label className="mb-2 block text-sm font-medium">Scoring Method</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateScoringMethod('sum')}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                config.scoring.method === 'sum'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-secondary'
              }`}
            >
              Sum
            </button>
            <button
              type="button"
              onClick={() => updateScoringMethod('average')}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                config.scoring.method === 'average'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-secondary'
              }`}
            >
              Average
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Score Ranges</label>
            <button
              type="button"
              onClick={addRange}
              className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
            >
              <Plus className="h-3 w-3" />
              Add Range
            </button>
          </div>

          {config.scoring.ranges.map((range, index) => (
            <div key={index} className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium">Min Score</label>
                      <input
                        type="number"
                        value={range.min}
                        onChange={(e) => updateRange(index, { min: Number(e.target.value) })}
                        className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Max Score</label>
                      <input
                        type="number"
                        value={range.max}
                        onChange={(e) => updateRange(index, { max: Number(e.target.value) })}
                        className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Label</label>
                      <input
                        type="text"
                        value={range.label}
                        onChange={(e) => updateRange(index, { label: e.target.value })}
                        className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Description</label>
                    <input
                      type="text"
                      value={range.description}
                      onChange={(e) => updateRange(index, { description: e.target.value })}
                      className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Recommendations (one per line)
                    </label>
                    <textarea
                      value={range.recommendations.join('\n')}
                      onChange={(e) => updateRangeRecommendations(index, e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRange(index)}
                  className="ml-3 mt-4 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
