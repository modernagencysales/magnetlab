'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
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
import { useCopilot } from '@/components/copilot/CopilotProvider';
import { useCopilotContext } from '@/components/copilot/useCopilotContext';
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

  const { open: openCopilot, sendMessage, startNewConversation } = useCopilot();

  useCopilotContext({
    page: 'lead-magnet-creation',
    entityType: 'lead-magnet',
    entityId: draftId || undefined,
    entityTitle: selectedConcept?.title || 'New Lead Magnet',
  });

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

  if ((generating === 'extraction' || isExtractionJobLoading) && !isRegenerationRef.current) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={3} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <GeneratingScreen message="Extracting your content..." />
        </div>
      </div>
    );
  }

  if (generating === 'posts' || isPostsJobLoading) {
    return (
      <div className="min-h-screen bg-background">
        <WizardProgress currentStep={4} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <GeneratingScreen message="Writing your LinkedIn posts..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* AI Assistant Entry Point */}
      <div className="border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
        <div className="container mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Create with AI Assistant</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Describe what you want — the AI uses your knowledge base to ask only the questions
                that matter.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                startNewConversation();
                openCopilot();
                sendMessage('I want to create a new lead magnet.');
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <MessageSquare className="h-4 w-4" />
              Open AI Assistant
            </button>
          </div>
        </div>
      </div>

      <WizardProgress currentStep={state.currentStep} />

      {autoSaveEnabled && (isSaving || lastSavedAt) && (
        <div className="border-b bg-card">
          <div className="container mx-auto max-w-4xl px-4 py-1.5">
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
