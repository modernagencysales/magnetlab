'use client';

import { useState, useMemo, useCallback } from 'react';
import { Parser } from 'expr-eval';
import type { CalculatorConfig, CalculatorInput, ResultInterpretation } from '@/lib/types/lead-magnet';

interface CalculatorToolProps {
  config: CalculatorConfig;
  theme: 'dark' | 'light';
  primaryColor: string;
}

const parser = new Parser();

function formatResult(value: number, format: CalculatorConfig['resultFormat']): string {
  if (isNaN(value) || !isFinite(value)) return '--';
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  }
}

function getInterpretation(value: number, interpretations: ResultInterpretation[]): ResultInterpretation | null {
  return interpretations.find((i) => value >= i.range[0] && value <= i.range[1]) || null;
}

const INTERPRETATION_COLORS: Record<ResultInterpretation['color'], { bg: string; text: string; border: string }> = {
  green: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/30' },
  red: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30' },
};

function isUnitPrefix(unit: string): boolean {
  return unit === '$' || unit === '\u00A3' || unit === '\u20AC';
}

export function CalculatorTool({ config, theme, primaryColor }: CalculatorToolProps) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const input of config.inputs) {
      initial[input.id] = input.defaultValue ?? 0;
    }
    return initial;
  });

  const handleChange = useCallback((id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  }, []);

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

  const isDark = theme === 'dark';
  const interpretationColors = interpretation ? INTERPRETATION_COLORS[interpretation.color] : null;

  const containerClasses = isDark
    ? 'bg-gray-900 text-white'
    : 'bg-white text-gray-900';

  const inputBgClasses = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400';

  const mutedTextClasses = isDark ? 'text-gray-400' : 'text-gray-500';
  const labelClasses = isDark ? 'text-gray-200' : 'text-gray-700';

  function renderInput(input: CalculatorInput, value: number) {
    switch (input.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(input.id, Number(e.target.value))}
            className={`w-full rounded-xl border px-4 py-3 text-base transition-all focus:outline-none focus:ring-2 ${inputBgClasses}`}
            style={{ focusRingColor: primaryColor } as React.CSSProperties}
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
          <div className="space-y-2">
            <input
              type="range"
              min={input.min ?? 0}
              max={input.max ?? 100}
              step={input.step ?? 1}
              value={value}
              onChange={(e) => handleChange(input.id, Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: primaryColor,
                background: isDark
                  ? `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${((value - (input.min ?? 0)) / ((input.max ?? 100) - (input.min ?? 0))) * 100}%, #374151 ${((value - (input.min ?? 0)) / ((input.max ?? 100) - (input.min ?? 0))) * 100}%, #374151 100%)`
                  : `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${((value - (input.min ?? 0)) / ((input.max ?? 100) - (input.min ?? 0))) * 100}%, #e5e7eb ${((value - (input.min ?? 0)) / ((input.max ?? 100) - (input.min ?? 0))) * 100}%, #e5e7eb 100%)`,
              }}
            />
            <div className={`flex justify-between text-sm ${mutedTextClasses}`}>
              <span>{input.min ?? 0}</span>
              <span className="font-semibold" style={{ color: primaryColor }}>
                {input.unit ? `${value} ${input.unit}` : value}
              </span>
              <span>{input.max ?? 100}</span>
            </div>
          </div>
        );

      case 'number':
      default: {
        const hasPrefix = input.unit && isUnitPrefix(input.unit);
        const hasSuffix = input.unit && !isUnitPrefix(input.unit);
        return (
          <div className="relative flex items-center">
            {hasPrefix && (
              <span className={`absolute left-4 text-base ${mutedTextClasses}`}>
                {input.unit}
              </span>
            )}
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(input.id, Number(e.target.value))}
              placeholder={input.placeholder || ''}
              min={input.min}
              max={input.max}
              step={input.step}
              className={`w-full rounded-xl border px-4 py-3 text-base transition-all focus:outline-none focus:ring-2 ${inputBgClasses} ${hasPrefix ? 'pl-8' : ''} ${hasSuffix ? 'pr-16' : ''}`}
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
            {hasSuffix && (
              <span className={`absolute right-4 text-base ${mutedTextClasses}`}>
                {input.unit}
              </span>
            )}
          </div>
        );
      }
    }
  }

  return (
    <div className={`rounded-2xl p-6 md:p-8 ${containerClasses}`}>
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{config.headline}</h2>
        <p className={`mt-2 text-base md:text-lg ${mutedTextClasses}`}>{config.description}</p>
      </div>

      {/* Input Fields - 2 column grid on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {config.inputs.map((input) => (
          <div key={input.id} className={input.type === 'slider' ? 'md:col-span-2' : ''}>
            <label className={`mb-2 block text-sm font-semibold ${labelClasses}`}>
              {input.label}
            </label>
            {renderInput(input, values[input.id] ?? 0)}
          </div>
        ))}
      </div>

      {/* Result */}
      <div
        className={`rounded-xl border-2 p-6 md:p-8 text-center transition-all duration-300 ${
          interpretationColors
            ? `${interpretationColors.bg} ${interpretationColors.border}`
            : ''
        }`}
        style={
          !interpretationColors
            ? {
                backgroundColor: `${primaryColor}10`,
                borderColor: `${primaryColor}30`,
              }
            : undefined
        }
      >
        <div className={`text-sm font-semibold uppercase tracking-wider ${mutedTextClasses}`}>
          {config.resultLabel}
        </div>
        <div
          className="mt-2 text-4xl md:text-5xl font-bold transition-all duration-300"
          style={{ color: interpretationColors ? undefined : primaryColor }}
        >
          <span className={interpretationColors ? interpretationColors.text : ''}>
            {formatResult(result, config.resultFormat)}
          </span>
        </div>

        {interpretation && (
          <div className="mt-4 space-y-2">
            <span
              className={`inline-block rounded-full px-4 py-1.5 text-sm font-semibold ${
                interpretationColors!.bg
              } ${interpretationColors!.text} border ${interpretationColors!.border}`}
            >
              {interpretation.label}
            </span>
            <p className={`text-sm md:text-base ${mutedTextClasses}`}>
              {interpretation.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
