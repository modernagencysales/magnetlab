'use client';

/** Onboarding Intake Card. Multiple-choice question with radio/checkbox options.
 *  Never imports server-only modules or NextResponse. */

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
            <span className="shrink-0">
              {isMulti ? (
                selected.includes(opt.value) ? (
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    className="text-violet-600"
                  >
                    <rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" />
                    <path
                      d="M4 7l2 2 4-4"
                      stroke="white"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    className="text-muted-foreground/40"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="12"
                      height="12"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                )
              ) : selected.includes(opt.value) ? (
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  className="text-violet-600"
                >
                  <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="7" cy="7" r="3.5" fill="currentColor" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  className="text-muted-foreground/40"
                >
                  <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
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
