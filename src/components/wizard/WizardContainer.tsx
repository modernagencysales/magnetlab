'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { PageContainer, Button } from '@magnetlab/magnetui';
import { ContextStep } from './steps/ContextStep';
import { IdeationStep } from './steps/IdeationStep';
import { CustomIdeaStep } from './steps/CustomIdeaStep';
import { ExtractionStep } from './steps/ExtractionStep';
import { ContentStep } from './steps/ContentStep';
import { InteractiveContentStep } from './steps/InteractiveContentStep';
import { PostStep } from './steps/PostStep';
import { PublishStep } from './steps/PublishStep';
import { GeneratingScreen } from './GeneratingScreen';
import { WizardProgress } from './WizardProgress';
import { DraftPicker } from './DraftPicker';
import { useWizard } from '@/frontend/hooks/useWizard';
import { useCopilotPageContext } from '@/components/copilot/CopilotNavigator';
import type { BusinessContext } from '@/lib/types/lead-magnet';

export function WizardContainer() {
  const {
    state,
    setState,
    generating,
    error,
    setError,
    loadingBrandKit,
    showDraftPicker,
    drafts,
    autoSaveEnabled,
    isSaving,
    lastSavedAt,
    draftId,
    isJobLoading,
    isExtractionJobLoading,
    isPostsJobLoading,
    isRegenerationRef,
    selectedConcept,
    selectedPost,
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
    savedIdeation,
    ideationGeneratedAt,
  } = useWizard();

  useCopilotPageContext({
    page: 'lead-magnet-creation',
    entityType: 'lead-magnet',
    entityId: draftId || undefined,
    entityTitle: selectedConcept?.title || 'New Lead Magnet',
  });

  if (loadingBrandKit) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={1} />
        <PageContainer maxWidth="lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContainer>
      </div>
    );
  }

  if (showDraftPicker) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={1} />
        <PageContainer maxWidth="lg">
          <DraftPicker
            drafts={drafts}
            onSelect={handleDraftSelect}
            onDelete={handleDraftDelete}
            onStartNew={handleStartNew}
          />
        </PageContainer>
      </div>
    );
  }

  if (generating === 'ideas' || isJobLoading) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={1} />
        <PageContainer maxWidth="lg">
          <GeneratingScreen />
        </PageContainer>
      </div>
    );
  }

  if ((generating === 'extraction' || isExtractionJobLoading) && !isRegenerationRef.current) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={3} />
        <PageContainer maxWidth="lg">
          <GeneratingScreen message="Extracting your content..." />
        </PageContainer>
      </div>
    );
  }

  if (generating === 'posts' || isPostsJobLoading) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={4} />
        <PageContainer maxWidth="lg">
          <GeneratingScreen message="Writing your LinkedIn posts..." />
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <WizardProgress currentStep={state.currentStep} />

      {autoSaveEnabled && (isSaving || lastSavedAt) && (
        <div className="border-b bg-card">
          <div className="mx-auto max-w-4xl px-4 py-1.5">
            <p className="text-xs text-muted-foreground">
              {isSaving
                ? 'Saving draft...'
                : lastSavedAt
                  ? `Draft saved ${formatTimeSince(lastSavedAt)}`
                  : ''}
            </p>
          </div>
        </div>
      )}

      <PageContainer maxWidth="lg">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="text-destructive hover:text-destructive"
            >
              Dismiss
            </Button>
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

            {state.currentStep === 2 &&
              (state.isCustomIdea ? (
                <CustomIdeaStep onSubmit={handleCustomIdeaSubmit} onBack={() => goToStep(1)} />
              ) : state.ideationResult ? (
                <IdeationStep
                  result={state.ideationResult}
                  onSelect={handleConceptSelect}
                  onBack={() => goToStep(1)}
                />
              ) : null)}

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

            {state.currentStep === 4 && state.interactiveConfig && selectedConcept && (
              <InteractiveContentStep
                config={state.interactiveConfig}
                concept={selectedConcept}
                onConfigChange={handleInteractiveConfigChange}
                onApprove={handleInteractiveApprove}
                onBack={() => goToStep(3)}
                onRegenerate={handleRegenerateInteractive}
                loading={generating !== 'idle'}
                regenerating={isExtractionJobLoading}
              />
            )}

            {state.currentStep === 4 && state.extractedContent && !state.interactiveConfig && (
              <ContentStep
                content={state.extractedContent}
                onApprove={handleContentApprove}
                onContentChange={(updated) =>
                  setState((prev) => ({ ...prev, extractedContent: updated }))
                }
                onBack={() => goToStep(3)}
                loading={generating !== 'idle'}
              />
            )}

            {state.currentStep === 5 && state.postResult && (
              <PostStep
                result={state.postResult}
                onSelect={handlePostSelect}
                onBack={() => goToStep(4)}
              />
            )}

            {state.currentStep === 6 &&
              selectedPost &&
              (state.extractedContent || state.interactiveConfig) && (
                <PublishStep
                  content={state.extractedContent}
                  post={selectedPost}
                  dmTemplate={state.postResult?.dmTemplate || ''}
                  ctaWord={state.postResult?.ctaWord || ''}
                  concept={selectedConcept!}
                  interactiveConfig={state.interactiveConfig}
                  onBack={() => goToStep(5)}
                  draftId={draftId}
                />
              )}
          </motion.div>
        </AnimatePresence>
      </PageContainer>
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
