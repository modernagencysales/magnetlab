'use client';

import { useState, useMemo } from 'react';
import { Parser } from 'expr-eval';
import type { CalculatorConfig, CalculatorInput, ResultInterpretation } from '@/lib/types/lead-magnet';

interface CalculatorPreviewProps {
  config: CalculatorConfig;
}

const parser = new Parser();

function formatResult(value: number, format: CalculatorConfig['resultFormat']): string {
  if (isNaN(value) || !isFinite(value)) return '--';
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
}

function getInterpretation(value: number, interpretations: ResultInterpretation[]): ResultInterpretation | null {
  return interpretations.find((i) => value >= i.range[0] && value <= i.range[1]) || null;
}

const COLOR_CLASSES: Record<ResultInterpretation['color'], { bg: string; text: string; border: string }> = {
  green: { bg: 'bg-green-500/10', text: 'text-green-700 dark:text-green-400', border: 'border-green-500/30' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-500/30' },
  red: { bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/30' },
};

function renderInput(
  input: CalculatorInput,
  value: number,
  onChange: (id: string, val: number) => void
) {
  switch (input.type) {
    case 'select':
      return (
        <select
          value={value}
          onChange={(e) => onChange(input.id, Number(e.target.value))}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {(input.options || []).map((opt, idx) => (
            <option key={idx} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'slider':
      return (
        <div className="space-y-1">
          <input
            type="range"
            min={input.min ?? 0}
            max={input.max ?? 100}
            step={input.step ?? 1}
            value={value}
            onChange={(e) => onChange(input.id, Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{input.min ?? 0}</span>
            <span className="font-medium text-foreground">
              {input.unit ? `${value} ${input.unit}` : value}
            </span>
            <span>{input.max ?? 100}</span>
          </div>
        </div>
      );
    case 'number':
    default:
      return (
        <div className="relative">
          {input.unit && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {input.unit === '$' || input.unit === '%' ? '' : ''}
            </span>
          )}
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(input.id, Number(e.target.value))}
            placeholder={input.placeholder || ''}
            min={input.min}
            max={input.max}
            step={input.step}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {input.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {input.unit}
            </span>
          )}
        </div>
      );
  }
}

export function CalculatorPreview({ config }: CalculatorPreviewProps) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const input of config.inputs) {
      initial[input.id] = input.defaultValue ?? 0;
    }
    return initial;
  });

  const handleChange = (id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  const result = useMemo(() => {
    try {
      const expr = parser.parse(config.formula);
      return expr.evaluate(values);
    } catch {
      return NaN;
    }
  }, [config.formula, values]);

  const interpretation = useMemo(() => {
    if (isNaN(result)) return null;
    return getInterpretation(result, config.resultInterpretation);
  }, [result, config.resultInterpretation]);

  const interpretationColors = interpretation ? COLOR_CLASSES[interpretation.color] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">{config.headline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
      </div>

      {/* Input Fields */}
      <div className="space-y-4">
        {config.inputs.map((input) => (
          <div key={input.id}>
            <label className="mb-1.5 block text-sm font-medium">{input.label}</label>
            {renderInput(input, values[input.id] ?? 0, handleChange)}
          </div>
        ))}
      </div>

      {/* Result */}
      <div
        className={`rounded-lg border p-5 text-center ${
          interpretationColors
            ? `${interpretationColors.bg} ${interpretationColors.border}`
            : 'bg-primary/5 border-primary/20'
        }`}
      >
        <div className="text-sm font-medium text-muted-foreground">{config.resultLabel}</div>
        <div
          className={`mt-1 text-3xl font-bold ${
            interpretationColors ? interpretationColors.text : 'text-primary'
          }`}
        >
          {formatResult(result, config.resultFormat)}
        </div>
        {interpretation && (
          <div className="mt-3 space-y-1">
            <div
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                interpretationColors!.bg
              } ${interpretationColors!.text}`}
            >
              {interpretation.label}
            </div>
            <p className="text-sm text-muted-foreground">{interpretation.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
