'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles, FileText, Lightbulb, History, Users, Eye, X, Check } from 'lucide-react';
import type { BusinessContext, BusinessType, IdeationSources, CallTranscriptInsights, CompetitorAnalysis } from '@/lib/types/lead-magnet';
import { BUSINESS_TYPE_LABELS } from '@/lib/types/lead-magnet';
import { SmartImportTab } from './SmartImportTab';

type TabValue = 'smart' | 'manual';
type ModalType = 'transcript' | 'inspiration' | null;

interface ContextStepProps {
  initialData: Partial<BusinessContext>;
  onSubmit: (context: BusinessContext, sources?: IdeationSources) => void;
  onCustomIdea?: (context: BusinessContext) => void;
  onUseSavedIdeas?: () => void;
  hasSavedIdeas?: boolean;
  savedIdeasDate?: string | null;
  loading: boolean;
  ideationSources?: IdeationSources;
  onIdeationSourcesChange?: (sources: IdeationSources) => void;
}

export function ContextStep({ initialData, onSubmit, onCustomIdea, onUseSavedIdeas, hasSavedIdeas, savedIdeasDate, loading, ideationSources = {}, onIdeationSourcesChange }: ContextStepProps) {
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

  // Local state for ideation sources if not controlled externally
  const [localSources, setLocalSources] = useState<IdeationSources>({});
  const sources = ideationSources || localSources;
  const handleSourcesChange = onIdeationSourcesChange || setLocalSources;

  // Modal state for alternate ideation modes
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalText, setModalText] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [transcriptInsights, setTranscriptInsights] = useState<CallTranscriptInsights | null>(null);
  const [competitorAnalysis, setCompetitorAnalysis] = useState<CompetitorAnalysis | null>(null);

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

    const context: BusinessContext = {
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
    };

    // Include sources if any have been analyzed
    const hasAnySources = sources.callTranscript?.insights || sources.competitorInspiration?.analysis;
    onSubmit(context, hasAnySources ? sources : undefined);
  };

  // Modal handlers for alternate ideation modes
  const handleOpenModal = (type: ModalType) => {
    setActiveModal(type);
    setModalText('');
    setModalError(null);
    setTranscriptInsights(null);
    setCompetitorAnalysis(null);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setModalText('');
    setModalError(null);
  };

  const handleAnalyzeTranscript = async () => {
    if (!modalText.trim()) return;
    setModalLoading(true);
    setModalError(null);

    try {
      const response = await fetch('/api/lead-magnet/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: modalText }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze transcript');
      }
      setTranscriptInsights(data.insights);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAnalyzeCompetitor = async () => {
    if (!modalText.trim()) return;
    setModalLoading(true);
    setModalError(null);

    try {
      const response = await fetch('/api/lead-magnet/analyze-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: modalText }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze content');
      }
      setCompetitorAnalysis(data.analysis);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setModalLoading(false);
    }
  };

  const handleGenerateFromTranscript = () => {
    if (!transcriptInsights || !formData.businessDescription || !formData.businessType) return;

    const context: BusinessContext = {
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
    };

    const newSources: IdeationSources = {
      callTranscript: {
        raw: modalText,
        insights: transcriptInsights,
      },
    };

    handleSourcesChange(newSources);
    handleCloseModal();
    onSubmit(context, newSources);
  };

  const handleGenerateFromInspiration = () => {
    if (!competitorAnalysis || !formData.businessDescription || !formData.businessType) return;

    const context: BusinessContext = {
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
    };

    const newSources: IdeationSources = {
      competitorInspiration: {
        raw: modalText,
        analysis: competitorAnalysis,
      },
    };

    handleSourcesChange(newSources);
    handleCloseModal();
    onSubmit(context, newSources);
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

        {/* Choice Buttons */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-center">How would you like to proceed?</p>

          {/* Use Saved Ideas - shown first if available */}
          {hasSavedIdeas && onUseSavedIdeas && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={onUseSavedIdeas}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <History className="h-4 w-4" />
                Use Previously Generated Ideas
              </button>
              <p className="text-xs text-muted-foreground text-center">
                Generated {savedIdeasDate ? new Date(savedIdeasDate).toLocaleDateString() : 'recently'}
              </p>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <span className="relative bg-muted/30 px-2 text-xs text-muted-foreground">or</span>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading || !formData.businessDescription}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              hasSavedIdeas
                ? 'border border-border bg-background hover:bg-muted/50'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating 10 lead magnet ideas...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate {hasSavedIdeas ? 'New' : '10 AI'} Ideas
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            {hasSavedIdeas ? 'Create fresh concepts from your context' : 'Uses your context to create concepts'}
          </p>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-muted/30 px-2 text-xs text-muted-foreground">or ideate from</span>
          </div>

          {/* Alternate Ideation Modes */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading || !formData.businessDescription}
              onClick={() => handleOpenModal('transcript')}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-4 text-sm font-medium hover:bg-muted/50 hover:border-primary/50 disabled:opacity-50 transition-colors"
            >
              <Users className="h-5 w-5 text-blue-500" />
              <span>Call Transcript</span>
              <span className="text-xs text-muted-foreground font-normal">Extract real pain points</span>
            </button>
            <button
              type="button"
              disabled={loading || !formData.businessDescription}
              onClick={() => handleOpenModal('inspiration')}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-4 text-sm font-medium hover:bg-muted/50 hover:border-primary/50 disabled:opacity-50 transition-colors"
            >
              <Eye className="h-5 w-5 text-purple-500" />
              <span>Inspiration Post</span>
              <span className="text-xs text-muted-foreground font-normal">Adapt what works</span>
            </button>
          </div>

          {onCustomIdea && (
            <>
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <span className="relative bg-muted/30 px-2 text-xs text-muted-foreground">or</span>
              </div>

              <button
                type="button"
                disabled={loading || !formData.businessDescription}
                onClick={() => {
                  if (!formData.businessDescription || !formData.businessType) return;
                  onCustomIdea({
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
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-muted/50 disabled:opacity-50 transition-colors"
              >
                <Lightbulb className="h-4 w-4" />
                I Have My Own Idea
              </button>
              <p className="text-xs text-muted-foreground text-center">Skip to entering your concept</p>
            </>
          )}
        </div>
      </form>
      )}

      {/* Modal for Transcript Analysis */}
      {activeModal === 'transcript' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-background border border-border shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Ideate from Call Transcript</h3>
                  <p className="text-sm text-muted-foreground">Paste a sales or coaching call to extract real customer insights</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!transcriptInsights ? (
                <>
                  <textarea
                    value={modalText}
                    onChange={(e) => setModalText(e.target.value)}
                    placeholder="Paste your sales call, coaching session, or customer interview transcript here...

We'll extract:
• Pain points with direct quotes
• Frequently asked questions
• Desired transformation outcomes
• Customer language patterns"
                    rows={10}
                    className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
                  />
                  {modalError && (
                    <p className="text-sm text-destructive">{modalError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleAnalyzeTranscript}
                    disabled={modalLoading || !modalText.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 text-white px-6 py-3 text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {modalLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing transcript...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analyze Transcript
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-600">Analysis Complete</span>
                    </div>

                    <div className="space-y-3 text-sm">
                      {transcriptInsights.painPoints.length > 0 && (
                        <div>
                          <p className="font-medium mb-1">Pain Points ({transcriptInsights.painPoints.length})</p>
                          <ul className="space-y-1 text-muted-foreground">
                            {transcriptInsights.painPoints.slice(0, 3).map((p, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-muted-foreground/50">•</span>
                                <span>&ldquo;{p.quote}&rdquo;</span>
                              </li>
                            ))}
                            {transcriptInsights.painPoints.length > 3 && (
                              <li className="text-muted-foreground/70">+{transcriptInsights.painPoints.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {transcriptInsights.frequentQuestions.length > 0 && (
                        <div>
                          <p className="font-medium mb-1">Questions ({transcriptInsights.frequentQuestions.length})</p>
                          <ul className="space-y-1 text-muted-foreground">
                            {transcriptInsights.frequentQuestions.slice(0, 2).map((q, i) => (
                              <li key={i}>• {q.question}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {transcriptInsights.languagePatterns.length > 0 && (
                        <div>
                          <p className="font-medium mb-1">Language Patterns</p>
                          <div className="flex flex-wrap gap-1">
                            {transcriptInsights.languagePatterns.slice(0, 5).map((phrase, i) => (
                              <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">
                                {phrase}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateFromTranscript}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating ideas...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Ideas from These Insights
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptInsights(null);
                      setModalText('');
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    Start Over
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Inspiration Analysis */}
      {activeModal === 'inspiration' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-background border border-border shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Eye className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Ideate from Inspiration</h3>
                  <p className="text-sm text-muted-foreground">Paste a successful lead magnet to analyze and adapt</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!competitorAnalysis ? (
                <>
                  <textarea
                    value={modalText}
                    onChange={(e) => setModalText(e.target.value)}
                    placeholder="Paste a competitor's post, lead magnet description, or promotional content here...

We'll analyze:
• What type of lead magnet it is
• The pain point it addresses
• Why it's effective
• How to adapt it for your business"
                    rows={10}
                    className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
                  />
                  {modalError && (
                    <p className="text-sm text-destructive">{modalError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleAnalyzeCompetitor}
                    disabled={modalLoading || !modalText.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500 text-white px-6 py-3 text-sm font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors"
                  >
                    {modalLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing content...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analyze Content
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-600">Analysis Complete</span>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium mb-1">Detected Format</p>
                        <p className="text-muted-foreground">{competitorAnalysis.detectedArchetype || competitorAnalysis.format}</p>
                      </div>

                      <div>
                        <p className="font-medium mb-1">Pain Point Addressed</p>
                        <p className="text-muted-foreground">{competitorAnalysis.painPointAddressed}</p>
                      </div>

                      {competitorAnalysis.effectivenessFactors.length > 0 && (
                        <div>
                          <p className="font-medium mb-1">Why It Works</p>
                          <ul className="space-y-1 text-muted-foreground">
                            {competitorAnalysis.effectivenessFactors.slice(0, 3).map((factor, i) => (
                              <li key={i}>• {factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {competitorAnalysis.adaptationSuggestions.length > 0 && (
                        <div>
                          <p className="font-medium mb-1">Adaptation Ideas</p>
                          <ul className="space-y-1 text-muted-foreground">
                            {competitorAnalysis.adaptationSuggestions.slice(0, 2).map((suggestion, i) => (
                              <li key={i}>• {suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateFromInspiration}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating ideas...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Adapted Ideas
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCompetitorAnalysis(null);
                      setModalText('');
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    Start Over
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
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
