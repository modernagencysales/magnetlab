'use client';

import { useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { InteractiveConfig, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import { CalculatorPreview } from '@/components/interactive/CalculatorPreview';
import { AssessmentPreview } from '@/components/interactive/AssessmentPreview';
import { GPTPreview } from '@/components/interactive/GPTPreview';
import { CalculatorEditor } from '@/components/interactive/editors/CalculatorEditor';
import { AssessmentEditor } from '@/components/interactive/editors/AssessmentEditor';
import { GPTEditor } from '@/components/interactive/editors/GPTEditor';
import type { CalculatorConfig, AssessmentConfig, GPTConfig } from '@/lib/types/lead-magnet';

interface InteractiveContentStepProps {
  config: InteractiveConfig;
  concept: LeadMagnetConcept;
  onConfigChange: (config: InteractiveConfig) => void;
  onApprove: () => void;
  onBack: () => void;
  onRegenerate: () => void;
  loading: boolean;
  regenerating: boolean;
}

const TYPE_LABELS: Record<InteractiveConfig['type'], string> = {
  calculator: 'Calculator',
  assessment: 'Assessment',
  gpt: 'AI Chat Tool',
};

const TYPE_DESCRIPTIONS: Record<InteractiveConfig['type'], string> = {
  calculator: 'An interactive calculator that helps your audience get personalized results.',
  assessment: 'A scored assessment that gives your audience actionable insights about where they stand.',
  gpt: 'An AI-powered chat tool that gives your audience personalized advice.',
};

type TabId = 'preview' | 'edit';

export function InteractiveContentStep({
  config,
  concept,
  onConfigChange,
  onApprove,
  onBack,
  onRegenerate,
  loading,
  regenerating,
}: InteractiveContentStepProps) {
  const [activeTab, setActiveTab] = useState<TabId>('preview');

  const renderPreview = () => {
    switch (config.type) {
      case 'calculator':
        return <CalculatorPreview config={config} />;
      case 'assessment':
        return <AssessmentPreview config={config} />;
      case 'gpt':
        return <GPTPreview config={config} />;
      default:
        return null;
    }
  };

  const renderEditor = () => {
    switch (config.type) {
      case 'calculator':
        return (
          <CalculatorEditor
            config={config}
            onChange={(c) => onConfigChange(c as InteractiveConfig)}
          />
        );
      case 'assessment':
        return (
          <AssessmentEditor
            config={config as AssessmentConfig}
            onChange={(c) => onConfigChange(c as InteractiveConfig)}
          />
        );
      case 'gpt':
        return (
          <GPTEditor
            config={config as GPTConfig}
            onChange={(c) => onConfigChange(c as InteractiveConfig)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Your Interactive Tool</h1>
          <p className="mt-2 text-muted-foreground">
            {TYPE_DESCRIPTIONS[config.type]} Preview it below, or switch to the Edit tab to tweak the details.
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Tool type badge */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {TYPE_LABELS[config.type]}
        </span>
        <span className="text-sm text-muted-foreground">{concept.title}</span>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border bg-card">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'preview'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'edit'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Edit
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'preview' ? renderPreview() : renderEditor()}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onRegenerate}
          disabled={regenerating || loading}
          className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          {regenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </>
          )}
        </button>

        <button
          onClick={onApprove}
          disabled={loading || regenerating}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating LinkedIn posts...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Looks Good &mdash; Generate Posts
            </>
          )}
        </button>
      </div>
    </div>
  );
}
