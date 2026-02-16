'use client';

import { useState, useCallback, useEffect } from 'react';
import posthog from 'posthog-js';
import { motion, AnimatePresence } from 'framer-motion';
import { ContextStep } from './steps/ContextStep';
import { IdeationStep } from './steps/IdeationStep';
import { CustomIdeaStep } from './steps/CustomIdeaStep';
import { ExtractionStep } from './steps/ExtractionStep';
import { ContentStep } from './steps/ContentStep';
import { PostStep } from './steps/PostStep';
import { PublishStep } from './steps/PublishStep';
import { GeneratingScreen } from './GeneratingScreen';
import { WizardProgress } from './WizardProgress';
import { DraftPicker } from './DraftPicker';
import { useBackgroundJob } from '@/lib/hooks/useBackgroundJob';
import { useWizardAutoSave } from '@/lib/hooks/useWizardAutoSave';
import { logError, logWarn } from '@/lib/utils/logger';

import { isInteractiveArchetype } from '@/lib/types/lead-magnet';
import type {
  WizardState,
  WizardDraft,
  BusinessContext,
  IdeationResult,
  ExtractedContent,
  InteractiveConfig,
  PostWriterResult,
  LeadMagnetArchetype,
  LeadMagnetConcept,
  IdeationSources,
} from '@/lib/types/lead-magnet';

type GeneratingState = 'idle' | 'ideas' | 'extraction' | 'posts';

const INITIAL_STATE: WizardState = {
  currentStep: 1,
  brandKit: {},
  ideationSources: {},
  ideationResult: null,
  selectedConceptIndex: null,
  extractionAnswers: {},
  chatMessages: [],
  extractedContent: null,
  postResult: null,
  selectedPostIndex: null,
  interactiveConfig: null,
  isCustomIdea: false,
  customConcept: null,
};

export function WizardContainer() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [generating, setGenerating] = useState<GeneratingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingBrandKit, setLoadingBrandKit] = useState(true);
  const [savedIdeation, setSavedIdeation] = useState<IdeationResult | null>(null);
  const [ideationGeneratedAt, setIdeationGeneratedAt] = useState<string | null>(null);

  // Draft management
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<WizardDraft[]>([]);

  const { startPolling, isLoading: isJobLoading } = useBackgroundJob<IdeationResult>({
    pollInterval: 2000,
    timeout: 360000, // 6 minutes - provides buffer after AI timeout (MOD-68)
    onComplete: (ideationResult) => {
      setState((prev) => ({
        ...prev,
        ideationResult,
        currentStep: 2,
      }));
      setGenerating('idle');
    },
    onError: (errorMessage) => {
      setError(errorMessage);
      setState((prev) => ({ ...prev, currentStep: 1 }));
      setGenerating('idle');
    },
  });

  // Auto-save hook
  const autoSaveEnabled = generating === 'idle' && state.currentStep >= 1 && state.currentStep < 6;
  const { draftId, isSaving, lastSavedAt, hasUnsavedChanges } = useWizardAutoSave({
    state,
    draftId: activeDraftId,
    enabled: autoSaveEnabled,
  });

  // Keep activeDraftId in sync with the hook's draftId (set after first save)
  useEffect(() => {
    if (draftId !== activeDraftId) {
      setActiveDraftId(draftId);
    }
  }, [draftId, activeDraftId]);

  // Warn before closing with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Load saved brand kit, ideation, and drafts on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [brandKitRes, draftsRes] = await Promise.all([
          fetch('/api/brand-kit'),
          fetch('/api/wizard-draft'),
        ]);

        if (brandKitRes.ok) {
          const data = await brandKitRes.json();
          if (data.brandKit) {
            const bk = data.brandKit;
            // Convert snake_case API response to camelCase BusinessContext
            const brandKit: Partial<BusinessContext> = {
              businessDescription: bk.business_description || '',
              businessType: bk.business_type || 'coach-consultant',
              credibilityMarkers: bk.credibility_markers || [],
              urgentPains: bk.urgent_pains || [],
              templates: bk.templates || [],
              processes: bk.processes || [],
              tools: bk.tools || [],
              frequentQuestions: bk.frequent_questions || [],
              results: bk.results || [],
              successExample: bk.success_example || '',
              audienceTools: bk.audience_tools || [],
            };
            setState((prev) => ({ ...prev, brandKit }));
          }
          // Load saved ideation if available
          if (data.savedIdeation) {
            setSavedIdeation(data.savedIdeation);
            setIdeationGeneratedAt(data.ideationGeneratedAt);
          }
        }

        if (draftsRes.ok) {
          const data = await draftsRes.json();
          if (data.drafts && data.drafts.length > 0) {
            setDrafts(data.drafts);
            setShowDraftPicker(true);
          }
        }
      } catch (err) {
        logWarn('wizard/container', 'Failed to load initial data', { detail: String(err) });
      } finally {
        setLoadingBrandKit(false);
      }
    }
    loadInitialData();
  }, []);

  const handleDraftSelect = useCallback((draft: WizardDraft) => {
    setState(draft.wizard_state);
    setActiveDraftId(draft.id);
    setShowDraftPicker(false);
  }, []);

  const handleDraftDelete = useCallback((id: string) => {
    setDrafts((prev) => {
      const remaining = prev.filter((d) => d.id !== id);
      if (remaining.length === 0) setShowDraftPicker(false);
      return remaining;
    });
  }, []);

  const handleStartNew = useCallback(() => {
    setActiveDraftId(null);
    setShowDraftPicker(false);
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }));
    setError(null);
  }, []);

  const handleIdeationSourcesChange = useCallback((sources: IdeationSources) => {
    setState((prev) => ({ ...prev, ideationSources: sources }));
  }, []);

  const handleContextSubmit = useCallback(async (context: BusinessContext, sources?: IdeationSources) => {
    try { posthog.capture('wizard_started', { source: 'context' }); } catch {}
    setGenerating('ideas');
    setError(null);

    // Update sources in state if provided
    if (sources) {
      setState((prev) => ({ ...prev, ideationSources: sources }));
    }

    try {
      // Build request body with optional sources
      const requestBody: Record<string, unknown> = { ...context };
      if (sources) {
        requestBody.sources = {
          callTranscriptInsights: sources.callTranscript?.insights,
          competitorAnalysis: sources.competitorInspiration?.analysis,
        };
      }

      // Trigger background job
      const response = await fetch('/api/lead-magnet/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to start ideation');
        } else {
          const text = await response.text();
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
        }
      }

      const { jobId } = await response.json();

      // Update state with context (even though ideas aren't ready yet)
      setState((prev) => ({
        ...prev,
        brandKit: context,
      }));

      // Start polling for results
      startPolling(jobId);
    } catch (err) {
      logError('wizard/container', err, { step: 'context_submit_error' });
      setError(err instanceof Error ? err.message : 'An error occurred');
      setState((prev) => ({ ...prev, currentStep: 1 }));
      setGenerating('idle');
    }
  }, [startPolling]);

  const handleConceptSelect = useCallback((index: number) => {
    try { posthog.capture('wizard_concept_selected', { concept_index: index }); } catch {}
    setState((prev) => ({
      ...prev,
      selectedConceptIndex: index,
      currentStep: 3,
    }));
  }, []);

  const handleUseSavedIdeas = useCallback(() => {
    if (savedIdeation) {
      setState((prev) => ({
        ...prev,
        ideationResult: savedIdeation,
        currentStep: 2,
      }));
    }
  }, [savedIdeation]);

  const handleCustomIdeaStart = useCallback(async (context: BusinessContext) => {
    try { posthog.capture('wizard_custom_idea_started'); } catch {}
    setError(null);

    try {
      // Save business context to brand_kit (same as normal flow)
      const brandKitResponse = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });

      if (!brandKitResponse.ok) {
        logWarn('wizard/container', 'Failed to save brand kit, continuing anyway');
      }

      setState((prev) => ({
        ...prev,
        brandKit: context,
        isCustomIdea: true,
        currentStep: 2,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, []);

  const handleCustomIdeaSubmit = useCallback((concept: LeadMagnetConcept) => {
    setState((prev) => ({
      ...prev,
      customConcept: concept,
      selectedConceptIndex: 0, // Treat as "selected" for downstream compatibility
      currentStep: 3,
    }));
  }, []);

  const handleExtractionComplete = useCallback(async (
    answers: Record<string, string>,
    archetype: LeadMagnetArchetype,
    concept: LeadMagnetConcept
  ) => {
    setGenerating('extraction');
    setError(null);

    try {
      // Include transcript insights if available to enhance AI content extraction
      const transcriptInsights = state.ideationSources?.callTranscript?.insights;

      if (isInteractiveArchetype(archetype)) {
        // Interactive path: generate calculator/assessment/GPT config
        const response = await fetch('/api/lead-magnet/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate-interactive',
            archetype,
            concept,
            answers,
            businessContext: state.brandKit,
            transcriptInsights,
          }),
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to generate interactive config');
          } else {
            const text = await response.text();
            logError('wizard/container', new Error(text), { step: 'non-json_error_response' });
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
          }
        }

        const { interactiveConfig } = await response.json() as { interactiveConfig: InteractiveConfig };
        try { posthog.capture('wizard_extraction_completed', { archetype, interactive: true }); } catch {}

        setState((prev) => ({
          ...prev,
          extractionAnswers: answers,
          interactiveConfig,
          extractedContent: null,  // No text content for interactive
          currentStep: 4,
        }));
      } else {
        // Standard text extraction path
        const response = await fetch('/api/lead-magnet/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            archetype,
            concept,
            answers,
            transcriptInsights, // Pass coaching call insights to enhance extraction
          }),
        });

        if (!response.ok) {
          // Handle both JSON and non-JSON error responses
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to process extraction');
          } else {
            const text = await response.text();
            logError('wizard/container', new Error(text), { step: 'non-json_error_response' });
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
          }
        }

        const extractedContent: ExtractedContent = await response.json();
        try { posthog.capture('wizard_extraction_completed', { archetype }); } catch {}

        setState((prev) => ({
          ...prev,
          extractionAnswers: answers,
          extractedContent,
          interactiveConfig: null,
          currentStep: 4,
        }));
      }
    } catch (err) {
      logError('wizard/container', err, { step: 'extraction_error' });
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating('idle');
    }
  }, [state.ideationSources, state.brandKit]);

  const handleContentApprove = useCallback(async () => {
    // Support both AI-generated and custom concepts
    const concept = state.isCustomIdea && state.customConcept
      ? state.customConcept
      : state.ideationResult && state.selectedConceptIndex !== null
        ? state.ideationResult.concepts[state.selectedConceptIndex]
        : null;

    if (!state.extractedContent || !concept) {
      return;
    }

    setGenerating('posts');
    setError(null);

    try {

      const response = await fetch('/api/lead-magnet/write-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadMagnetTitle: state.extractedContent.title,
          format: state.extractedContent.format,
          contents: state.extractedContent.structure
            .map((s) => `${s.sectionName}: ${s.contents.join(', ')}`)
            .join('; '),
          problemSolved: concept.painSolved,
          credibility: (state.brandKit.credibilityMarkers || []).join(', '),
          audience: state.brandKit.businessType || 'B2B professionals',
          audienceStyle: 'casual-direct',
          proof: state.extractedContent.proof,
          ctaWord: 'LINK',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate posts');
      }

      const postResult: PostWriterResult = await response.json();
      try { posthog.capture('wizard_content_approved'); } catch {}

      setState((prev) => ({
        ...prev,
        postResult,
        currentStep: 5,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating('idle');
    }
  }, [state.extractedContent, state.ideationResult, state.selectedConceptIndex, state.brandKit, state.isCustomIdea, state.customConcept]);

  const handlePostSelect = useCallback((index: number) => {
    try { posthog.capture('wizard_post_selected', { post_index: index }); } catch {}
    setState((prev) => ({
      ...prev,
      selectedPostIndex: index,
      currentStep: 6,
    }));
  }, []);

  const selectedConcept =
    state.isCustomIdea && state.customConcept
      ? state.customConcept
      : state.ideationResult && state.selectedConceptIndex !== null
        ? state.ideationResult.concepts[state.selectedConceptIndex]
        : null;

  const selectedPost =
    state.postResult && state.selectedPostIndex !== null
      ? state.postResult.variations[state.selectedPostIndex]
      : null;

  // Show loading state while fetching saved brand kit
  if (loadingBrandKit) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={1} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  // Show draft picker
  if (showDraftPicker) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={1} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <DraftPicker
            drafts={drafts}
            onSelect={handleDraftSelect}
            onDelete={handleDraftDelete}
            onStartNew={handleStartNew}
          />
        </div>
      </div>
    );
  }

  // Show generating screen when generating ideas or polling for job results
  if (generating === 'ideas' || isJobLoading) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={1} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <GeneratingScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <WizardProgress currentStep={state.currentStep} />

      {/* Auto-save indicator */}
      {autoSaveEnabled && (isSaving || lastSavedAt) && (
        <div className="border-b bg-card">
          <div className="container mx-auto max-w-4xl px-4 py-1.5">
            <p className="text-xs text-muted-foreground">
              {isSaving ? 'Saving draft...' : lastSavedAt ? `Draft saved ${formatTimeSince(lastSavedAt)}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-lg bg-destructive/10 p-4 text-destructive">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-4 text-sm font-medium underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {state.currentStep === 1 && (
              <ContextStep
                initialData={state.brandKit}
                onSubmit={handleContextSubmit}
                onCustomIdea={handleCustomIdeaStart}
                onUseSavedIdeas={handleUseSavedIdeas}
                hasSavedIdeas={!!savedIdeation}
                savedIdeasDate={ideationGeneratedAt}
                loading={generating !== 'idle'}
                ideationSources={state.ideationSources}
                onIdeationSourcesChange={handleIdeationSourcesChange}
              />
            )}

            {state.currentStep === 2 && (
              state.isCustomIdea ? (
                <CustomIdeaStep
                  onSubmit={handleCustomIdeaSubmit}
                  onBack={() => goToStep(1)}
                />
              ) : state.ideationResult ? (
                <IdeationStep
                  result={state.ideationResult}
                  onSelect={handleConceptSelect}
                  onBack={() => goToStep(1)}
                />
              ) : null
            )}

            {state.currentStep === 3 && selectedConcept && (
              <ExtractionStep
                concept={selectedConcept}
                initialAnswers={state.extractionAnswers}
                onComplete={handleExtractionComplete}
                onBack={() => goToStep(2)}
                loading={generating === 'extraction'}
                ideationSources={state.ideationSources}
                businessContext={state.brandKit as BusinessContext}
              />
            )}

            {state.currentStep === 4 && state.extractedContent && (
              <ContentStep
                content={state.extractedContent}
                onApprove={handleContentApprove}
                onBack={() => goToStep(3)}
                loading={generating === 'posts'}
              />
            )}

            {state.currentStep === 5 && state.postResult && (
              <PostStep
                result={state.postResult}
                onSelect={handlePostSelect}
                onBack={() => goToStep(4)}
              />
            )}

            {state.currentStep === 6 && selectedPost && state.extractedContent && (
              <PublishStep
                content={state.extractedContent}
                post={selectedPost}
                dmTemplate={state.postResult?.dmTemplate || ''}
                ctaWord={state.postResult?.ctaWord || ''}
                concept={selectedConcept!}
                onBack={() => goToStep(5)}
                draftId={draftId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
