'use client';

import type { AssessmentConfig } from '@/lib/types/lead-magnet';

interface AssessmentPreviewProps {
  config: AssessmentConfig;
}

export function AssessmentPreview({ config }: AssessmentPreviewProps) {
  const previewQuestions = config.questions.slice(0, 3);
  const totalQuestions = config.questions.length;
  const hasMore = totalQuestions > 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">{config.headline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
      </div>

      {/* Question Preview Cards */}
      <div className="space-y-3">
        {previewQuestions.map((question, index) => (
          <div key={question.id} className="rounded-lg border bg-background p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {index + 1}
              </span>
              <p className="text-sm font-medium">{question.text}</p>
            </div>

            {/* Answer options preview */}
            {question.type === 'single_choice' && question.options && (
              <div className="ml-8 space-y-1.5">
                {question.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                    <span className="text-sm text-muted-foreground">{opt.label}</span>
                  </div>
                ))}
              </div>
            )}

            {question.type === 'multiple_choice' && question.options && (
              <div className="ml-8 space-y-1.5">
                {question.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <div className="h-4 w-4 shrink-0 rounded border-2 border-muted-foreground/30" />
                    <span className="text-sm text-muted-foreground">{opt.label}</span>
                  </div>
                ))}
              </div>
            )}

            {question.type === 'scale' && (
              <div className="ml-8">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{question.scaleLabels?.min || question.scaleMin || 1}</span>
                  <div className="mx-2 flex flex-1 gap-1">
                    {Array.from(
                      { length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1 },
                      (_, i) => (
                        <div
                          key={i}
                          className="h-2 flex-1 rounded-full bg-muted-foreground/20"
                        />
                      )
                    )}
                  </div>
                  <span>{question.scaleLabels?.max || question.scaleMax || 5}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {hasMore && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-center text-sm text-muted-foreground">
            +{totalQuestions - 3} more question{totalQuestions - 3 > 1 ? 's' : ''} in the full assessment
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="rounded-lg bg-blue-500/10 p-3 text-center text-sm text-blue-700 dark:text-blue-400">
        Full assessment experience shown to your audience
      </div>

      {/* Scoring summary */}
      <div className="rounded-lg border bg-background p-4">
        <h3 className="mb-3 text-sm font-semibold">Scoring Summary</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">{totalQuestions}</div>
            <div className="text-xs text-muted-foreground">Questions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary capitalize">{config.scoring.method}</div>
            <div className="text-xs text-muted-foreground">Scoring</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{config.scoring.ranges.length}</div>
            <div className="text-xs text-muted-foreground">Result Levels</div>
          </div>
        </div>

        {config.scoring.ranges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {config.scoring.ranges.map((range, idx) => (
              <span
                key={idx}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
              >
                {range.label} ({range.min}&ndash;{range.max})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
