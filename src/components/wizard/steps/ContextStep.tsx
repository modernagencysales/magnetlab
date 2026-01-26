'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles, FileText } from 'lucide-react';
import type { BusinessContext, BusinessType } from '@/lib/types/lead-magnet';
import { BUSINESS_TYPE_LABELS } from '@/lib/types/lead-magnet';
import { SmartImportTab } from './SmartImportTab';

type TabValue = 'smart' | 'manual';

interface ContextStepProps {
  initialData: Partial<BusinessContext>;
  onSubmit: (context: BusinessContext) => void;
  loading: boolean;
}

export function ContextStep({ initialData, onSubmit, loading }: ContextStepProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('smart');
  const [hasExtracted, setHasExtracted] = useState(false);
  const [formData, setFormData] = useState<Partial<BusinessContext>>({
    businessDescription: initialData.businessDescription || '',
    businessType: initialData.businessType || 'coach-consultant',
    credibilityMarkers: initialData.credibilityMarkers || [],
    urgentPains: initialData.urgentPains || [],
    templates: initialData.templates || [],
    processes: initialData.processes || [],
    tools: initialData.tools || [],
    frequentQuestions: initialData.frequentQuestions || [],
    results: initialData.results || [],
    successExample: initialData.successExample || '',
  });

  const [currentInput, setCurrentInput] = useState({
    credibility: '',
    pain: '',
    result: '',
    question: '',
  });

  // Auto-switch to manual tab if initial data has content
  useEffect(() => {
    if (initialData.businessDescription || initialData.businessType) {
      setActiveTab('manual');
    }
  }, [initialData]);

  // Handle extracted context from Smart Import
  const handleExtracted = (extracted: Partial<BusinessContext>) => {
    setFormData((prev) => ({
      ...prev,
      ...extracted,
    }));
    setHasExtracted(true);
    setActiveTab('manual'); // Switch to manual tab for fine-tuning
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.businessDescription || !formData.businessType) {
      return;
    }

    onSubmit({
      businessDescription: formData.businessDescription,
      businessType: formData.businessType,
      credibilityMarkers: formData.credibilityMarkers || [],
      urgentPains: formData.urgentPains || [],
      templates: formData.templates || [],
      processes: formData.processes || [],
      tools: formData.tools || [],
      frequentQuestions: formData.frequentQuestions || [],
      results: formData.results || [],
      successExample: formData.successExample,
    });
  };

  const addToArray = (field: keyof Pick<BusinessContext, 'credibilityMarkers' | 'urgentPains' | 'results' | 'frequentQuestions'>, inputKey: keyof typeof currentInput) => {
    const value = currentInput[inputKey].trim();
    if (value) {
      setFormData((prev) => ({
        ...prev,
        [field]: [...(prev[field] || []), value],
      }));
      setCurrentInput((prev) => ({ ...prev, [inputKey]: '' }));
    }
  };

  const removeFromArray = (field: keyof Pick<BusinessContext, 'credibilityMarkers' | 'urgentPains' | 'results' | 'frequentQuestions'>, index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tell us about your business</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll use this to generate lead magnet ideas tailored to your expertise and audience.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-4" aria-label="Tabs">
          <TabButton
            active={activeTab === 'smart'}
            onClick={() => setActiveTab('smart')}
            icon={<Sparkles className="h-4 w-4" />}
            label="Smart Import"
            description="Paste content, AI extracts"
          />
          <TabButton
            active={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
            icon={<FileText className="h-4 w-4" />}
            label="Manual Entry"
            description="Fill out the form"
            badge={hasExtracted ? 'Extracted' : undefined}
          />
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'smart' ? (
        <SmartImportTab onExtracted={handleExtracted} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Type */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">What type of business are you?</label>
          <select
            value={formData.businessType}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, businessType: e.target.value as BusinessType }))
            }
            className="mt-2 w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none cursor-pointer focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          >
            {Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Business Description */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Describe what you do and who you serve
          </label>
          <textarea
            value={formData.businessDescription}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, businessDescription: e.target.value }))
            }
            placeholder="I help [specific audience] achieve [specific outcome] through [your method/approach]..."
            rows={3}
            className="mt-2 w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
            required
          />
        </div>

        {/* Credibility Markers */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Credibility markers (specific results you&apos;ve achieved)
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Numbers work best: &quot;$2.3M in client revenue&quot;, &quot;1,200+ students&quot;, &quot;15 years experience&quot;
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={currentInput.credibility}
              onChange={(e) =>
                setCurrentInput((prev) => ({ ...prev, credibility: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addToArray('credibilityMarkers', 'credibility');
                }
              }}
              placeholder="Add a credibility marker..."
              className="flex-1 rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => addToArray('credibilityMarkers', 'credibility')}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(formData.credibilityMarkers || []).map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeFromArray('credibilityMarkers', index)}
                  className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Urgent Pains */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            What are the 3 most urgent pains your audience faces?
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={currentInput.pain}
              onChange={(e) =>
                setCurrentInput((prev) => ({ ...prev, pain: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addToArray('urgentPains', 'pain');
                }
              }}
              placeholder="Add a pain point..."
              className="flex-1 rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => addToArray('urgentPains', 'pain')}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(formData.urgentPains || []).map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeFromArray('urgentPains', index)}
                  className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Results */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            What results have you achieved for yourself or clients?
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={currentInput.result}
              onChange={(e) =>
                setCurrentInput((prev) => ({ ...prev, result: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addToArray('results', 'result');
                }
              }}
              placeholder="Add a result..."
              className="flex-1 rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => addToArray('results', 'result')}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(formData.results || []).map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 text-xs font-medium"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeFromArray('results', index)}
                  className="ml-1 text-green-600 dark:text-green-500 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Success Example */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Do you have a success example we could break down? (optional)
          </label>
          <textarea
            value={formData.successExample}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, successExample: e.target.value }))
            }
            placeholder="A campaign, post, email, or process that worked really well..."
            rows={2}
            className="mt-2 w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !formData.businessDescription}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating 10 lead magnet ideas...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Lead Magnet Ideas
            </>
          )}
        </button>
      </form>
      )}
    </div>
  );
}

// Tab button component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
}

function TabButton({ active, onClick, icon, label, description, badge }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 border-b-2 transition-colors
        ${active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
        }
      `}
    >
      <div className={`p-2 rounded-lg ${active ? 'bg-primary/10' : 'bg-muted'}`}>
        {icon}
      </div>
      <div className="text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-xs bg-green-500/10 text-green-600 rounded">
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </button>
  );
}
