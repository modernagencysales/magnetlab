'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
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
import type { FunnelPage, FunnelPageSection, QualificationQuestion, GeneratedOptinContent, FunnelTheme, FunnelTargetType, BackgroundStyle, RedirectTrigger } from '@/lib/types/funnel';
import type { LeadMagnet, PolishedContent } from '@/lib/types/lead-magnet';
import type { Library } from '@/lib/types/library';

interface FunnelBuilderProps {
  leadMagnet?: LeadMagnet;
  library?: Library;
  externalResource?: { id: string; title: string; url: string; icon: string };
  existingFunnel: FunnelPage | null;
  existingQuestions: QualificationQuestion[];
  username: string | null;
}

type TabType = 'optin' | 'thankyou' | 'questions' | 'theme' | 'sections' | 'content' | 'email';

export function FunnelBuilder({
  leadMagnet,
  library,
  externalResource,
  existingFunnel,
  existingQuestions,
  username,
}: FunnelBuilderProps) {
  // Derive target info
  const targetType: FunnelTargetType = library ? 'library' : externalResource ? 'external_resource' : 'lead_magnet';
  const targetTitle = leadMagnet?.title || library?.name || externalResource?.title || 'Untitled';
  const targetId = leadMagnet?.id || library?.id || externalResource?.id || '';
  const isLeadMagnetTarget = targetType === 'lead_magnet';
  const backLink = isLeadMagnetTarget ? '/magnets' : '/pages';
  const backLabel = isLeadMagnetTarget ? 'Back to Lead Magnets' : 'Back to Pages';

  const [activeTab, setActiveTab] = useState<TabType>('optin');
  const [funnel, setFunnel] = useState<FunnelPage | null>(existingFunnel);
  const [questions, setQuestions] = useState<QualificationQuestion[]>(existingQuestions);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for opt-in page
  const [optinHeadline, setOptinHeadline] = useState(existingFunnel?.optinHeadline || targetTitle);
  const [optinSubline, setOptinSubline] = useState(existingFunnel?.optinSubline || '');
  const [optinButtonText, setOptinButtonText] = useState(existingFunnel?.optinButtonText || 'Get Free Access');
  const [optinSocialProof, setOptinSocialProof] = useState(existingFunnel?.optinSocialProof || '');
  const [slug, setSlug] = useState(existingFunnel?.slug || generateSlug(targetTitle));

  // Form state for thank-you page
  const [thankyouHeadline, setThankyouHeadline] = useState(existingFunnel?.thankyouHeadline || 'Thanks! Check your email.');
  const [thankyouSubline, setThankyouSubline] = useState(existingFunnel?.thankyouSubline || '');
  const [vslUrl, setVslUrl] = useState(existingFunnel?.vslUrl || '');
  const [calendlyUrl, setCalendlyUrl] = useState(existingFunnel?.calendlyUrl || '');
  const [qualificationPassMessage, setQualificationPassMessage] = useState(existingFunnel?.qualificationPassMessage || 'Great! Book a call below.');
  const [qualificationFailMessage, setQualificationFailMessage] = useState(existingFunnel?.qualificationFailMessage || 'Thanks for your interest!');

  // Form state for redirect
  const [redirectTrigger, setRedirectTrigger] = useState<RedirectTrigger>(existingFunnel?.redirectTrigger || 'none');
  const [redirectUrl, setRedirectUrl] = useState(existingFunnel?.redirectUrl || '');
  const [redirectFailUrl, setRedirectFailUrl] = useState(existingFunnel?.redirectFailUrl || '');
  const [homepageUrl, setHomepageUrl] = useState(existingFunnel?.homepageUrl || '');
  const [homepageLabel, setHomepageLabel] = useState(existingFunnel?.homepageLabel || '');
  const [sendResourceEmail, setSendResourceEmail] = useState(existingFunnel?.sendResourceEmail ?? true);

  // Form state for theme
  const [theme, setTheme] = useState<FunnelTheme>(existingFunnel?.theme || 'dark');
  const [primaryColor, setPrimaryColor] = useState(existingFunnel?.primaryColor || '#8b5cf6');
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>(existingFunnel?.backgroundStyle || 'solid');
  const [logoUrl, setLogoUrl] = useState<string | null>(existingFunnel?.logoUrl || null);

  // Lead magnet state (for content tab updates)
  const [currentLeadMagnet, setCurrentLeadMagnet] = useState<LeadMagnet | undefined>(leadMagnet);

  // Sections state (shared between SectionsManager and FunnelPreview)
  const [sections, setSections] = useState<FunnelPageSection[]>([]);

  const fetchSections = useCallback(async () => {
    if (!funnel?.id) return;
    try {
      const res = await fetch(`/api/funnel/${funnel.id}/sections`);
      if (res.ok) {
        const data = await res.json();
        setSections(data.sections);
      }
    } catch {
      // ignore
    }
  }, [funnel?.id]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  const handleGenerateContent = async () => {
    if (!leadMagnet) return;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/funnel/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadMagnetId: leadMagnet.id, useAI: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const { content } = await response.json() as { content: GeneratedOptinContent };

      setOptinHeadline(content.headline);
      setOptinSubline(content.subline);
      setOptinSocialProof(content.socialProof);
      setOptinButtonText(content.buttonText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        slug,
        targetType,
        optinHeadline,
        optinSubline: optinSubline || null,
        optinButtonText,
        optinSocialProof: optinSocialProof || null,
        thankyouHeadline,
        thankyouSubline: thankyouSubline || null,
        vslUrl: vslUrl || null,
        calendlyUrl: calendlyUrl || null,
        qualificationPassMessage,
        qualificationFailMessage,
        redirectTrigger,
        redirectUrl: redirectTrigger !== 'none' ? (redirectUrl || null) : null,
        redirectFailUrl: redirectTrigger === 'after_qualification' ? (redirectFailUrl || null) : null,
        homepageUrl: homepageUrl || null,
        homepageLabel: homepageLabel || null,
        sendResourceEmail,
        theme,
        primaryColor,
        backgroundStyle,
        logoUrl,
      };

      // Set the correct target ID field
      if (targetType === 'lead_magnet') {
        payload.leadMagnetId = targetId;
      } else if (targetType === 'library') {
        payload.libraryId = targetId;
      } else if (targetType === 'external_resource') {
        payload.externalResourceId = targetId;
      }

      let response;
      if (funnel) {
        response = await fetch(`/api/funnel/${funnel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const data = await response.json();

        // If funnel already exists (409), reload to get the existing funnel
        if (response.status === 409) {
          window.location.reload();
          return;
        }

        throw new Error(data.error || 'Failed to save');
      }

      const { funnel: savedFunnel } = await response.json();
      setFunnel(savedFunnel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save when switching tabs (if funnel exists)
  useEffect(() => {
    // Don't auto-save if we don't have a funnel yet
    if (!funnel) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Build tabs based on target type
  const tabs: { id: TabType; label: string }[] = [
    { id: 'optin', label: 'Opt-in Page' },
    { id: 'thankyou', label: 'Thank-you Page' },
    { id: 'questions', label: 'Qualification' },
    { id: 'theme', label: 'Theme' },
    { id: 'sections', label: 'Sections' },
    // Content tab only for lead magnets
    ...(isLeadMagnetTarget ? [{ id: 'content' as const, label: 'Content' }] : []),
    { id: 'email', label: 'Email' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor Panel */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Funnel Page Builder</h1>
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
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
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
              onPolished={(polishedContent: PolishedContent, polishedAt: string) => {
                setCurrentLeadMagnet({
                  ...currentLeadMagnet,
                  polishedContent,
                  polishedAt,
                });
              }}
            />
          )}

          {activeTab === 'email' && isLeadMagnetTarget && leadMagnet && (
            <EmailSequenceTab
              leadMagnetId={leadMagnet.id}
            />
          )}

          {activeTab === 'email' && !isLeadMagnetTarget && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Email sequences are only available for lead magnet funnels.
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Link
            href={backLink}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {backLabel}
          </Link>
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

      {/* Preview Panel */}
      <div className="space-y-6">
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
          <PublishControls
            funnel={funnel}
            setFunnel={setFunnel}
            username={username}
          />
        )}

        {/* Lead Delivery Info */}
        <LeadDeliveryInfo />
      </div>
    </div>
  );
}
