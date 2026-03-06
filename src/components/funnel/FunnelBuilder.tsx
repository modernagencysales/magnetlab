'use client';

import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/index';
import { OptinPageEditor } from './OptinPageEditor';
import { ThankyouPageEditor } from './ThankyouPageEditor';
import { QuestionsManager } from './QuestionsManager';
import { ThemeEditor } from './ThemeEditor';
import { EmailSequenceTab } from './EmailSequenceTab';
import { ContentPageTab } from './ContentPageTab';
import { SectionsManager } from './SectionsManager';
import { FunnelPreview } from './FunnelPreview';
import { PublishControls } from './PublishControls';
import { LeadDeliveryInfo } from './LeadDeliveryInfo';
import { ABTestPanel } from './ABTestPanel';
import { FunnelIntegrationsTab } from './FunnelIntegrationsTab';
import type { QualificationQuestion, FunnelPage } from '@/lib/types/funnel';
import type { LeadMagnet } from '@/lib/types/lead-magnet';
import type { Library } from '@/lib/types/library';
import { useFunnelBuilder } from '@/frontend/hooks/useFunnelBuilder';

interface FunnelBuilderProps {
  leadMagnet?: LeadMagnet;
  library?: Library;
  externalResource?: { id: string; title: string; url: string; icon: string };
  existingFunnel: FunnelPage | null;
  existingQuestions: QualificationQuestion[];
  username: string | null;
  connectedEmailProviders?: string[];
}

export function FunnelBuilder({
  leadMagnet,
  library,
  externalResource,
  existingFunnel,
  existingQuestions,
  username,
  connectedEmailProviders = [],
}: FunnelBuilderProps) {
  const {
    isLeadMagnetTarget,
    backLink,
    backLabel,
    activeTab,
    setActiveTab,
    navGroups,
    activeGroup,
    isVisualTab,
    isTabComplete,
    funnel,
    setFunnel,
    questions,
    setQuestions,
    saving,
    generating,
    error,
    optinHeadline,
    setOptinHeadline,
    optinSubline,
    setOptinSubline,
    optinButtonText,
    setOptinButtonText,
    optinSocialProof,
    setOptinSocialProof,
    slug,
    setSlug,
    thankyouHeadline,
    setThankyouHeadline,
    thankyouSubline,
    setThankyouSubline,
    vslUrl,
    setVslUrl,
    calendlyUrl,
    setCalendlyUrl,
    qualificationPassMessage,
    setQualificationPassMessage,
    qualificationFailMessage,
    setQualificationFailMessage,
    redirectTrigger,
    setRedirectTrigger,
    redirectUrl,
    setRedirectUrl,
    redirectFailUrl,
    setRedirectFailUrl,
    homepageUrl,
    setHomepageUrl,
    homepageLabel,
    setHomepageLabel,
    sendResourceEmail,
    setSendResourceEmail,
    thankyouLayout,
    setThankyouLayout,
    theme,
    setTheme,
    primaryColor,
    setPrimaryColor,
    backgroundStyle,
    setBackgroundStyle,
    logoUrl,
    setLogoUrl,
    sections,
    setSections,
    fetchSections,
    currentLeadMagnet,
    setCurrentLeadMagnet,
    ghlConnected,
    heyreachConnected,
    handleSave,
    handleGenerateContent,
  } = useFunnelBuilder({
    leadMagnet,
    library,
    externalResource,
    existingFunnel,
    existingQuestions,
    username,
    connectedEmailProviders,
  });

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={backLink}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {backLabel}
          </Link>
          <h1 className="text-2xl font-semibold">Funnel Page Builder</h1>
        </div>
        <div className="flex items-center gap-3">
          {!funnel && isLeadMagnetTarget && (
            <button
              onClick={handleGenerateContent}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Copy with AI
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {funnel ? 'Save Changes' : 'Create Funnel'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Mobile: horizontal group pills */}
      <nav className="lg:hidden overflow-x-auto border-b">
        <div className="flex gap-1 px-2 py-2">
          {navGroups.map((group) => {
            const isActiveGroup = group.items.some((i) => i.id === activeTab);
            return (
              <button
                key={group.title}
                onClick={() => setActiveTab(group.items[0].id)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  isActiveGroup
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {group.title}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile: sub-tabs within active group */}
      <div className="lg:hidden flex gap-2">
        {activeGroup.items.map((item) => {
          const Icon = item.icon;
          const complete = isTabComplete(item.id);
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                activeTab === item.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {complete && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
            </button>
          );
        })}
      </div>

      {/* Main content area: sidebar + editor + preview */}
      <div className="flex gap-6">
        {/* Desktop sidebar nav */}
        <nav className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-24 space-y-6">
            {navGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h3>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = activeTab === item.id;
                    const complete = isTabComplete(item.id);
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                            active
                              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                          {complete && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Editor panel */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="min-h-[400px]">
            {activeTab === 'optin' && (
              <OptinPageEditor
                headline={optinHeadline}
                setHeadline={setOptinHeadline}
                subline={optinSubline}
                setSubline={setOptinSubline}
                buttonText={optinButtonText}
                setButtonText={setOptinButtonText}
                socialProof={optinSocialProof}
                setSocialProof={setOptinSocialProof}
                slug={slug}
                setSlug={setSlug}
              />
            )}

            {activeTab === 'thankyou' && (
              <div className="space-y-6">
                <ThankyouPageEditor
                  headline={thankyouHeadline}
                  setHeadline={setThankyouHeadline}
                  subline={thankyouSubline}
                  setSubline={setThankyouSubline}
                  vslUrl={vslUrl}
                  setVslUrl={setVslUrl}
                  calendlyUrl={calendlyUrl}
                  setCalendlyUrl={setCalendlyUrl}
                  passMessage={qualificationPassMessage}
                  setPassMessage={setQualificationPassMessage}
                  failMessage={qualificationFailMessage}
                  setFailMessage={setQualificationFailMessage}
                  redirectTrigger={redirectTrigger}
                  setRedirectTrigger={setRedirectTrigger}
                  redirectUrl={redirectUrl}
                  setRedirectUrl={setRedirectUrl}
                  redirectFailUrl={redirectFailUrl}
                  setRedirectFailUrl={setRedirectFailUrl}
                  homepageUrl={homepageUrl}
                  setHomepageUrl={setHomepageUrl}
                  homepageLabel={homepageLabel}
                  setHomepageLabel={setHomepageLabel}
                  sendResourceEmail={sendResourceEmail}
                  setSendResourceEmail={setSendResourceEmail}
                  layout={thankyouLayout}
                  setLayout={setThankyouLayout}
                />
                {funnel && <ABTestPanel funnelPageId={funnel.id} />}
              </div>
            )}

            {activeTab === 'questions' && (
              <QuestionsManager
                funnelId={funnel?.id || null}
                formId={funnel?.qualificationFormId || null}
                questions={questions}
                setQuestions={setQuestions}
                onNeedsSave={() => {
                  if (!funnel) {
                    handleSave();
                  }
                }}
              />
            )}

            {activeTab === 'theme' && (
              <ThemeEditor
                theme={theme}
                setTheme={setTheme}
                primaryColor={primaryColor}
                setPrimaryColor={setPrimaryColor}
                backgroundStyle={backgroundStyle}
                setBackgroundStyle={setBackgroundStyle}
                logoUrl={logoUrl}
                setLogoUrl={setLogoUrl}
                funnelId={funnel?.id}
                onBrandApplied={fetchSections}
              />
            )}

            {activeTab === 'sections' && (
              <SectionsManager
                funnelId={funnel?.id || null}
                sections={sections}
                onSectionsChange={setSections}
              />
            )}

            {activeTab === 'content' && isLeadMagnetTarget && currentLeadMagnet && (
              <ContentPageTab
                leadMagnet={currentLeadMagnet}
                username={username}
                slug={slug}
                onPolished={(polishedContent, polishedAt, extractedContent) => {
                  setCurrentLeadMagnet({
                    ...currentLeadMagnet,
                    polishedContent,
                    polishedAt,
                    ...(extractedContent ? { extractedContent } : {}),
                  });
                }}
              />
            )}

            {activeTab === 'email' && isLeadMagnetTarget && leadMagnet && (
              <EmailSequenceTab leadMagnetId={leadMagnet.id} />
            )}

            {activeTab === 'email' && !isLeadMagnetTarget && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Email sequences are only available for lead magnet funnels.
                </p>
              </div>
            )}

            {activeTab === 'integrations' && funnel && (
              <FunnelIntegrationsTab
                funnelPageId={funnel.id}
                connectedProviders={connectedEmailProviders}
                ghlConnected={ghlConnected}
                heyreachConnected={heyreachConnected}
                funnelUrl={
                  username && slug ? `https://magnetlab.app/p/${username}/${slug}` : undefined
                }
              />
            )}

            {activeTab === 'integrations' && !funnel && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Save your funnel first to configure email marketing integrations.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Preview panel - only for visual tabs, xl+ breakpoint */}
        {isVisualTab && (
          <div className="hidden xl:block w-[380px] shrink-0 space-y-6">
            <FunnelPreview
              headline={optinHeadline}
              subline={optinSubline}
              buttonText={optinButtonText}
              socialProof={optinSocialProof}
              questions={questions}
              sections={sections}
              theme={theme}
              primaryColor={primaryColor}
              backgroundStyle={backgroundStyle}
              logoUrl={logoUrl}
              thankyouHeadline={thankyouHeadline}
              thankyouSubline={thankyouSubline}
              vslUrl={vslUrl}
              calendlyUrl={calendlyUrl}
            />

            {funnel && (
              <PublishControls funnel={funnel} setFunnel={setFunnel} username={username} />
            )}

            <LeadDeliveryInfo />
          </div>
        )}
      </div>
    </div>
  );
}
