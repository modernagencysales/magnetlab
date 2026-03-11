'use client';

/** Onboarding Intake Card. Multiple-choice question with radio/checkbox options. */

import { useState } from 'react';

interface IntakeOption {
  value: string;
  label: string;
}

interface OnboardingIntakeCardProps {
  data:
    | {
        question?: string;
        options?: IntakeOption[];
        multi_select?: boolean;
        field_name?: string;
      }
    | undefined;
  onApply?: (type: string, data: unknown) => void;
}

export function OnboardingIntakeCard({ data, onApply }: OnboardingIntakeCardProps) {
  const [selected, setSelected] = useState<string[]>([]);

  if (!data?.question || !data?.options) return null;

  const isMulti = data.multi_select;

  const handleSelect = (value: string) => {
    if (isMulti) {
      setSelected((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else {
      setSelected([value]);
    }
  };

  const handleSubmit = () => {
    if (selected.length === 0) return;
    onApply?.('intake_answer', {
      field_name: data.field_name,
      value: isMulti ? selected : selected[0],
    });
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">{data.question}</p>
      <div className="mt-3 space-y-2">
        {data.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm transition-colors ${
              selected.includes(opt.value)
                ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                : 'hover:bg-muted'
            }`}
          >
            <span className="text-xs">
              {isMulti
                ? selected.includes(opt.value)
                  ? '☑'
                  : '☐'
                : selected.includes(opt.value)
                  ? '◉'
                  : '○'}
            </span>
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={selected.length === 0}
        className="mt-3 rounded bg-violet-600 px-4 py-1.5 text-xs text-white hover:bg-violet-700 disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
