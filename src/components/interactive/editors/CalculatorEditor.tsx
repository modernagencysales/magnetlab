'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { CalculatorConfig, CalculatorInput, ResultInterpretation } from '@/lib/types/lead-magnet';

interface CalculatorEditorProps {
  config: CalculatorConfig;
  onChange: (config: CalculatorConfig) => void;
}

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

export function CalculatorEditor({ config, onChange }: CalculatorEditorProps) {
  const update = (partial: Partial<CalculatorConfig>) => {
    onChange({ ...config, ...partial });
  };

  const updateInput = (index: number, partial: Partial<CalculatorInput>) => {
    const inputs = [...config.inputs];
    inputs[index] = { ...inputs[index], ...partial };
    // Auto-generate ID from label
    if (partial.label !== undefined) {
      inputs[index].id = toCamelCase(partial.label) || `input${index}`;
    }
    update({ inputs });
  };

  const addInput = () => {
    const newInput: CalculatorInput = {
      id: `input${config.inputs.length}`,
      label: '',
      type: 'number',
      defaultValue: 0,
    };
    update({ inputs: [...config.inputs, newInput] });
  };

  const removeInput = (index: number) => {
    const inputs = config.inputs.filter((_, i) => i !== index);
    update({ inputs });
  };

  const updateInputOption = (inputIndex: number, optIndex: number, field: 'label' | 'value', val: string) => {
    const inputs = [...config.inputs];
    const options = [...(inputs[inputIndex].options || [])];
    options[optIndex] = { ...options[optIndex], [field]: field === 'value' ? Number(val) : val };
    inputs[inputIndex] = { ...inputs[inputIndex], options };
    update({ inputs });
  };

  const addInputOption = (inputIndex: number) => {
    const inputs = [...config.inputs];
    const options = [...(inputs[inputIndex].options || []), { label: '', value: 0 }];
    inputs[inputIndex] = { ...inputs[inputIndex], options };
    update({ inputs });
  };

  const removeInputOption = (inputIndex: number, optIndex: number) => {
    const inputs = [...config.inputs];
    const options = (inputs[inputIndex].options || []).filter((_, i) => i !== optIndex);
    inputs[inputIndex] = { ...inputs[inputIndex], options };
    update({ inputs });
  };

  const updateInterpretation = (index: number, partial: Partial<ResultInterpretation>) => {
    const interpretations = [...config.resultInterpretation];
    interpretations[index] = { ...interpretations[index], ...partial };
    update({ resultInterpretation: interpretations });
  };

  const addInterpretation = () => {
    const newRange: ResultInterpretation = {
      range: [0, 100],
      label: '',
      description: '',
      color: 'green',
    };
    update({ resultInterpretation: [...config.resultInterpretation, newRange] });
  };

  const removeInterpretation = (index: number) => {
    const interpretations = config.resultInterpretation.filter((_, i) => i !== index);
    update({ resultInterpretation: interpretations });
  };

  const availableVariables = config.inputs.map((i) => i.id).join(', ');

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

      {/* Inputs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inputs</h3>
          <button
            type="button"
            onClick={addInput}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
          >
            <Plus className="h-3 w-3" />
            Add Input
          </button>
        </div>

        {config.inputs.map((input, index) => (
          <div key={index} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Label</label>
                    <input
                      type="text"
                      value={input.label}
                      onChange={(e) => updateInput(index, { label: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Type</label>
                    <select
                      value={input.type}
                      onChange={(e) => updateInput(index, { type: e.target.value as CalculatorInput['type'] })}
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="number">Number</option>
                      <option value="select">Select</option>
                      <option value="slider">Slider</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">ID (auto)</label>
                    <input
                      type="text"
                      value={input.id}
                      readOnly
                      className="w-full rounded-lg border bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Unit</label>
                    <input
                      type="text"
                      value={input.unit || ''}
                      onChange={(e) => updateInput(index, { unit: e.target.value })}
                      placeholder="e.g. $, %, hrs"
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Options for select type */}
                {input.type === 'select' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium">Options</label>
                      <button
                        type="button"
                        onClick={() => addInputOption(index)}
                        className="text-xs text-primary hover:underline"
                      >
                        + Add Option
                      </button>
                    </div>
                    {(input.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => updateInputOption(index, optIdx, 'label', e.target.value)}
                          placeholder="Label"
                          className="flex-1 rounded-lg border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <input
                          type="number"
                          value={opt.value}
                          onChange={(e) => updateInputOption(index, optIdx, 'value', e.target.value)}
                          placeholder="Value"
                          className="w-20 rounded-lg border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeInputOption(index, optIdx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeInput(index)}
                className="mt-4 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Formula */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Formula</h3>
        <div>
          <label className="mb-1 block text-sm font-medium">Formula Expression</label>
          <input
            type="text"
            value={config.formula}
            onChange={(e) => update({ formula: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Available variables: <code className="rounded bg-muted px-1 py-0.5">{availableVariables || 'none'}</code>
          </p>
        </div>
      </div>

      {/* Result */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Result</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Result Label</label>
            <input
              type="text"
              value={config.resultLabel}
              onChange={(e) => update({ resultLabel: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Format</label>
            <select
              value={config.resultFormat}
              onChange={(e) => update({ resultFormat: e.target.value as CalculatorConfig['resultFormat'] })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="number">Number</option>
              <option value="currency">Currency ($)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interpretation Ranges */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Interpretation Ranges
          </h3>
          <button
            type="button"
            onClick={addInterpretation}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
          >
            <Plus className="h-3 w-3" />
            Add Range
          </button>
        </div>

        {config.resultInterpretation.map((interp, index) => (
          <div key={index} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Min</label>
                    <input
                      type="number"
                      value={interp.range[0]}
                      onChange={(e) =>
                        updateInterpretation(index, { range: [Number(e.target.value), interp.range[1]] })
                      }
                      className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Max</label>
                    <input
                      type="number"
                      value={interp.range[1]}
                      onChange={(e) =>
                        updateInterpretation(index, { range: [interp.range[0], Number(e.target.value)] })
                      }
                      className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Color</label>
                    <select
                      value={interp.color}
                      onChange={(e) =>
                        updateInterpretation(index, { color: e.target.value as ResultInterpretation['color'] })
                      }
                      className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="green">Green</option>
                      <option value="yellow">Yellow</option>
                      <option value="red">Red</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Label</label>
                  <input
                    type="text"
                    value={interp.label}
                    onChange={(e) => updateInterpretation(index, { label: e.target.value })}
                    className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Description</label>
                  <input
                    type="text"
                    value={interp.description}
                    onChange={(e) => updateInterpretation(index, { description: e.target.value })}
                    className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeInterpretation(index)}
                className="ml-3 mt-4 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
