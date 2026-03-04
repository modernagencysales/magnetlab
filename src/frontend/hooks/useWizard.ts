'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { useBackgroundJob } from '@/frontend/hooks/useBackgroundJob';
import { useWizardAutoSave } from '@/frontend/hooks/useWizardAutoSave';
import { logError, logWarn } from '@/lib/utils/logger';
import { isInteractiveArchetype } from '@/lib/types/lead-magnet';
import type {
  WizardState,
  WizardDraft,
  WizardPendingJob,
  BusinessContext,
  IdeationResult,
  ExtractedContent,
  InteractiveConfig,
  PostWriterResult,
  LeadMagnetArchetype,
  LeadMagnetConcept,
  IdeationSources,
} from '@/lib/types/lead-magnet';
import * as brandKitApi from '@/frontend/api/brand-kit';
import * as wizardDraftApi from '@/frontend/api/wizard-draft';
import * as leadMagnetApi from '@/frontend/api/lead-magnet';

export type GeneratingState = 'idle' | 'ideas' | 'extraction' | 'posts';

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

export function useWizard() {
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

  // Refs for pending state during background jobs
  const pendingExtractionAnswersRef = useRef<Record<string, string>>({});
  const isRegenerationRef = useRef(false);

  const clearPendingJob = useCallback(() => {
    setState((prev) => (prev.pendingJob ? { ...prev, pendingJob: null } : prev));
  }, []);

  const {
    startPolling,
    isLoading: isJobLoading,
    checkJob: checkIdeationJob,
  } = useBackgroundJob<IdeationResult>({
    pollInterval: 2000,
    timeout: 360000,
    onComplete: (ideationResult) => {
      setState((prev) => ({ ...prev, ideationResult, currentStep: 2, pendingJob: null }));
      setGenerating('idle');
    },
    onError: (errorMessage) => {
      setError(errorMessage);
      setState((prev) => ({ ...prev, currentStep: 1, pendingJob: null }));
      setGenerating('idle');
    },
  });

  const {
    startPolling: startExtractionPolling,
    isLoading: isExtractionJobLoading,
    checkJob: checkExtractionJob,
  } = useBackgroundJob<{
    extractedContent?: ExtractedContent;
    interactiveConfig?: InteractiveConfig;
  }>({
    pollInterval: 2000,
    timeout: 360000,
    onComplete: (result) => {
      try {
        posthog.capture('wizard_extraction_completed', { interactive: !!result.interactiveConfig });
      } catch {}

      if (isRegenerationRef.current) {
        if (result.interactiveConfig) {
          try {
            posthog.capture('wizard_interactive_regenerated', {
              type: result.interactiveConfig.type,
            });
          } catch {}
          setState((prev) => ({
            ...prev,
            interactiveConfig: result.interactiveConfig!,
            pendingJob: null,
          }));
        } else {
          clearPendingJob();
        }
      } else if (result.interactiveConfig) {
        setState((prev) => ({
          ...prev,
          extractionAnswers: pendingExtractionAnswersRef.current,
          interactiveConfig: result.interactiveConfig!,
          extractedContent: null,
          currentStep: 4,
          pendingJob: null,
        }));
      } else if (result.extractedContent) {
        setState((prev) => ({
          ...prev,
          extractionAnswers: pendingExtractionAnswersRef.current,
          extractedContent: result.extractedContent!,
          interactiveConfig: null,
          currentStep: 4,
          pendingJob: null,
        }));
      } else {
        clearPendingJob();
      }
      isRegenerationRef.current = false;
      setGenerating('idle');
    },
    onError: (errorMessage) => {
      setError(errorMessage);
      isRegenerationRef.current = false;
      clearPendingJob();
      setGenerating('idle');
    },
  });

  const {
    startPolling: startPostsPolling,
    isLoading: isPostsJobLoading,
    checkJob: checkPostsJob,
  } = useBackgroundJob<PostWriterResult>({
    pollInterval: 2000,
    timeout: 360000,
    onComplete: (postResult) => {
      try {
        posthog.capture('wizard_content_approved');
      } catch {}
      setState((prev) => ({ ...prev, postResult, currentStep: 5, pendingJob: null }));
      setGenerating('idle');
    },
    onError: (errorMessage) => {
      setError(errorMessage);
      clearPendingJob();
      setGenerating('idle');
    },
  });

  const autoSaveEnabled = generating === 'idle' && state.currentStep >= 1 && state.currentStep < 6;
  const { draftId, isSaving, lastSavedAt, hasUnsavedChanges } = useWizardAutoSave({
    state,
    draftId: activeDraftId,
    enabled: autoSaveEnabled,
  });

  useEffect(() => {
    if (draftId !== activeDraftId) setActiveDraftId(draftId);
  }, [draftId, activeDraftId]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [brandKitData, draftsData] = await Promise.all([
          brandKitApi.getBrandKit(),
          wizardDraftApi.listDrafts(),
        ]);

        const data = brandKitData as {
          brandKit?: Record<string, unknown>;
          savedIdeation?: unknown;
          ideationGeneratedAt?: string;
        };
        if (data.brandKit) {
          const bk = data.brandKit as Record<string, unknown>;
          const brandKit: Partial<BusinessContext> = {
            businessDescription: (bk.business_description as string) || '',
            businessType: ((bk.business_type as string) ||
              'coach-consultant') as BusinessContext['businessType'],
            credibilityMarkers: (bk.credibility_markers as string[]) || [],
            urgentPains: (bk.urgent_pains as string[]) || [],
            templates: (bk.templates as string[]) || [],
            processes: (bk.processes as string[]) || [],
            tools: (bk.tools as string[]) || [],
            frequentQuestions: (bk.frequent_questions as string[]) || [],
            results: (bk.results as string[]) || [],
            successExample: (bk.success_example as string) || '',
            audienceTools: (bk.audience_tools as string[]) || [],
          };
          setState((prev) => ({ ...prev, brandKit }));
        }
        if (data.savedIdeation) {
          setSavedIdeation(data.savedIdeation as IdeationResult);
          setIdeationGeneratedAt(data.ideationGeneratedAt ?? null);
        }
        if (draftsData.drafts && draftsData.drafts.length > 0) {
          setDrafts(draftsData.drafts as WizardDraft[]);
          setShowDraftPicker(true);
        }
      } catch (err) {
        logWarn('wizard/container', 'Failed to load initial data', { detail: String(err) });
      } finally {
        setLoadingBrandKit(false);
      }
    }
    loadInitialData();
  }, []);

  const resumePendingJob = useCallback(
    async (pendingJob: WizardPendingJob) => {
      const { jobId, jobType } = pendingJob;
      const checkFn =
        jobType === 'ideation'
          ? checkIdeationJob
          : jobType === 'extraction'
            ? checkExtractionJob
            : checkPostsJob;
      const pollFn =
        jobType === 'ideation'
          ? startPolling
          : jobType === 'extraction'
            ? startExtractionPolling
            : startPostsPolling;
      const genState: GeneratingState =
        jobType === 'ideation' ? 'ideas' : jobType === 'extraction' ? 'extraction' : 'posts';
      const stillRunning = await checkFn(jobId);
      if (stillRunning) {
        setGenerating(genState);
        pollFn(jobId);
      }
    },
    [
      checkIdeationJob,
      checkExtractionJob,
      checkPostsJob,
      startPolling,
      startExtractionPolling,
      startPostsPolling,
    ]
  );

  const handleDraftSelect = useCallback(
    (draft: WizardDraft) => {
      setState(draft.wizard_state);
      setActiveDraftId(draft.id);
      setShowDraftPicker(false);
      if (draft.wizard_state.pendingJob) resumePendingJob(draft.wizard_state.pendingJob);
    },
    [resumePendingJob]
  );

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

  const handleContextSubmit = useCallback(
    async (context: BusinessContext, sources?: IdeationSources) => {
      try {
        posthog.capture('wizard_started', { source: 'context' });
      } catch {}
      setGenerating('ideas');
      setError(null);
      if (sources) setState((prev) => ({ ...prev, ideationSources: sources }));
      try {
        const requestBody: Record<string, unknown> = { ...context };
        if (sources) {
          requestBody.sources = {
            callTranscriptInsights: sources.callTranscript?.insights,
            competitorAnalysis: sources.competitorInspiration?.analysis,
          };
        }
        const result = await leadMagnetApi.ideate(requestBody);
        const jobId = result.jobId;
        if (!jobId) throw new Error('Failed to start ideation');
        setState((prev) => ({
          ...prev,
          brandKit: context,
          pendingJob: { jobId, jobType: 'ideation', startedAt: new Date().toISOString() },
        }));
        startPolling(jobId);
      } catch (err) {
        logError('wizard/container', err, { step: 'context_submit_error' });
        setError(err instanceof Error ? err.message : 'An error occurred');
        setState((prev) => ({ ...prev, currentStep: 1 }));
        setGenerating('idle');
      }
    },
    [startPolling]
  );

  const handleConceptSelect = useCallback((index: number) => {
    try {
      posthog.capture('wizard_concept_selected', { concept_index: index });
    } catch {}
    setState((prev) => ({ ...prev, selectedConceptIndex: index, currentStep: 3 }));
  }, []);

  const handleUseSavedIdeas = useCallback(() => {
    if (savedIdeation) {
      setState((prev) => ({ ...prev, ideationResult: savedIdeation, currentStep: 2 }));
    }
  }, [savedIdeation]);

  const handleCustomIdeaStart = useCallback(async (context: BusinessContext) => {
    try {
      posthog.capture('wizard_custom_idea_started');
    } catch {}
    setError(null);
    try {
      try {
        await brandKitApi.updateBrandKit(context as unknown as Record<string, unknown>);
      } catch {
        logWarn('wizard/container', 'Failed to save brand kit, continuing anyway');
      }
      setState((prev) => ({ ...prev, brandKit: context, isCustomIdea: true, currentStep: 2 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, []);

  const handleCustomIdeaSubmit = useCallback((concept: LeadMagnetConcept) => {
    setState((prev) => ({
      ...prev,
      customConcept: concept,
      selectedConceptIndex: 0,
      currentStep: 3,
    }));
  }, []);

  const handleExtractionComplete = useCallback(
    async (
      answers: Record<string, string>,
      archetype: LeadMagnetArchetype,
      concept: LeadMagnetConcept
    ) => {
      setGenerating('extraction');
      setError(null);
      pendingExtractionAnswersRef.current = answers;
      isRegenerationRef.current = false;
      try {
        const transcriptInsights = state.ideationSources?.callTranscript?.insights;
        const requestBody: Record<string, unknown> = {
          archetype,
          concept,
          answers,
          transcriptInsights,
        };
        if (isInteractiveArchetype(archetype)) {
          requestBody.action = 'generate-interactive';
          requestBody.businessContext = state.brandKit;
        }
        const result = await leadMagnetApi.extract(requestBody);
        const jobId = result.jobId;
        if (!jobId) throw new Error('Failed to start extraction');
        setState((prev) => ({
          ...prev,
          pendingJob: { jobId, jobType: 'extraction', startedAt: new Date().toISOString() },
        }));
        startExtractionPolling(jobId);
      } catch (err) {
        logError('wizard/container', err, { step: 'extraction_error' });
        setError(err instanceof Error ? err.message : 'An error occurred');
        setGenerating('idle');
      }
    },
    [state.ideationSources, state.brandKit, startExtractionPolling]
  );

  const handleContentApprove = useCallback(async () => {
    const concept =
      state.isCustomIdea && state.customConcept
        ? state.customConcept
        : state.ideationResult && state.selectedConceptIndex !== null
          ? state.ideationResult.concepts[state.selectedConceptIndex]
          : null;
    if (!state.extractedContent || !concept) return;
    setGenerating('posts');
    setError(null);
    try {
      const result = await leadMagnetApi.writePost({
        leadMagnetTitle: state.extractedContent.title,
        format: state.extractedContent.format,
        contents: state.extractedContent.structure
          .map((s) => `${s.sectionName}: ${s.contents.join(', ')}`)
          .join('; '),
        problemSolved: concept.painSolved,
        credibility: (state.brandKit.credibilityMarkers || []).join(', '),
        audience:
          state.brandKit.businessDescription || state.brandKit.businessType || 'B2B professionals',
        audienceStyle: 'casual-direct',
        proof: state.extractedContent.proof,
        ctaWord: 'LINK',
      });
      const jobId = result.jobId;
      if (!jobId) throw new Error('Failed to generate posts');
      setState((prev) => ({
        ...prev,
        pendingJob: { jobId, jobType: 'posts', startedAt: new Date().toISOString() },
      }));
      startPostsPolling(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setGenerating('idle');
    }
  }, [
    state.extractedContent,
    state.ideationResult,
    state.selectedConceptIndex,
    state.brandKit,
    state.isCustomIdea,
    state.customConcept,
    startPostsPolling,
  ]);

  const handleInteractiveConfigChange = useCallback((config: InteractiveConfig) => {
    setState((prev) => ({ ...prev, interactiveConfig: config }));
  }, []);

  const handleInteractiveApprove = useCallback(async () => {
    const concept =
      state.isCustomIdea && state.customConcept
        ? state.customConcept
        : state.ideationResult && state.selectedConceptIndex !== null
          ? state.ideationResult.concepts[state.selectedConceptIndex]
          : null;
    if (!state.interactiveConfig || !concept) return;
    setGenerating('posts');
    setError(null);
    try {
      const toolSummary =
        state.interactiveConfig.type === 'calculator'
          ? `${state.interactiveConfig.headline}: ${state.interactiveConfig.description}`
          : state.interactiveConfig.type === 'assessment'
            ? `${state.interactiveConfig.headline}: ${state.interactiveConfig.description}`
            : `${state.interactiveConfig.name}: ${state.interactiveConfig.description}`;
      const result = await leadMagnetApi.writePost({
        leadMagnetTitle: concept.title,
        format: concept.deliveryFormat,
        contents: toolSummary,
        problemSolved: concept.painSolved,
        credibility: (state.brandKit.credibilityMarkers || []).join(', '),
        audience:
          state.brandKit.businessDescription || state.brandKit.businessType || 'B2B professionals',
        audienceStyle: 'casual-direct',
        proof: concept.contents,
        ctaWord: 'LINK',
      });
      const jobId = result.jobId;
      if (!jobId) throw new Error('Failed to generate posts');
      try {
        posthog.capture('wizard_interactive_approved', { type: state.interactiveConfig.type });
      } catch {}
      setState((prev) => ({
        ...prev,
        pendingJob: { jobId, jobType: 'posts', startedAt: new Date().toISOString() },
      }));
      startPostsPolling(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setGenerating('idle');
    }
  }, [
    state.interactiveConfig,
    state.brandKit,
    state.isCustomIdea,
    state.customConcept,
    state.ideationResult,
    state.selectedConceptIndex,
    startPostsPolling,
  ]);

  const handleRegenerateInteractive = useCallback(async () => {
    const concept =
      state.isCustomIdea && state.customConcept
        ? state.customConcept
        : state.ideationResult && state.selectedConceptIndex !== null
          ? state.ideationResult.concepts[state.selectedConceptIndex]
          : null;
    if (!concept) return;
    setGenerating('extraction');
    setError(null);
    isRegenerationRef.current = true;
    try {
      const transcriptInsights = state.ideationSources?.callTranscript?.insights;
      const result = await leadMagnetApi.extract({
        action: 'generate-interactive',
        archetype: concept.archetype,
        concept,
        answers: state.extractionAnswers,
        businessContext: state.brandKit,
        transcriptInsights,
      });
      if (!result.jobId) throw new Error('Failed to regenerate interactive config');
      setState((prev) => ({
        ...prev,
        pendingJob: {
          jobId: result.jobId!,
          jobType: 'extraction',
          startedAt: new Date().toISOString(),
        },
      }));
      startExtractionPolling(result.jobId);
    } catch (err) {
      logError('wizard/container', err, { step: 'regenerate_interactive_error' });
      setError(err instanceof Error ? err.message : 'An error occurred');
      isRegenerationRef.current = false;
      setGenerating('idle');
    }
  }, [
    state.isCustomIdea,
    state.customConcept,
    state.ideationResult,
    state.selectedConceptIndex,
    state.extractionAnswers,
    state.ideationSources,
    state.brandKit,
    startExtractionPolling,
  ]);

  const handlePostSelect = useCallback((index: number) => {
    try {
      posthog.capture('wizard_post_selected', { post_index: index });
    } catch {}
    setState((prev) => ({ ...prev, selectedPostIndex: index, currentStep: 6 }));
  }, []);

  // Derived values
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

  return {
    state,
    setState,
    generating,
    error,
    setError,
    loadingBrandKit,
    savedIdeation,
    ideationGeneratedAt,
    showDraftPicker,
    drafts,
    // Auto-save
    autoSaveEnabled,
    isSaving,
    lastSavedAt,
    draftId,
    // Background job loading
    isJobLoading,
    isExtractionJobLoading,
    isPostsJobLoading,
    // Ref (needed for conditional render)
    isRegenerationRef,
    // Derived
    selectedConcept,
    selectedPost,
    // Handlers
    goToStep,
    handleIdeationSourcesChange,
    handleContextSubmit,
    handleConceptSelect,
    handleUseSavedIdeas,
    handleCustomIdeaStart,
    handleCustomIdeaSubmit,
    handleExtractionComplete,
    handleContentApprove,
    handleInteractiveConfigChange,
    handleInteractiveApprove,
    handleRegenerateInteractive,
    handlePostSelect,
    handleDraftSelect,
    handleDraftDelete,
    handleStartNew,
  };
}
