'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, FileText, CheckCircle2, Palette, LayoutGrid, PenLine, ClipboardList, Mail, Plug } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
import type { FunnelPage, FunnelPageSection, QualificationQuestion, GeneratedOptinContent, FunnelTheme, FunnelTargetType, BackgroundStyle, RedirectTrigger, ThankyouLayout } from '@/lib/types/funnel';
import type { LeadMagnet } from '@/lib/types/lead-magnet';
import type { Library } from '@/lib/types/library';

const VISUAL_TABS = new Set<TabType>(['optin', 'thankyou', 'theme', 'sections']);

interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface FunnelBuilderProps {
  leadMagnet?: LeadMagnet;
  library?: Library;
  externalResource?: { id: string; title: string; url: string; icon: string };
  existingFunnel: FunnelPage | null;
  existingQuestions: QualificationQuestion[];
  username: string | null;
  connectedEmailProviders?: string[];
}

type TabType = 'optin' | 'thankyou' | 'questions' | 'theme' | 'sections' | 'content' | 'email' | 'integrations';

export function FunnelBuilder({
  leadMagnet,
  library,
  externalResource,
  existingFunnel,
  existingQuestions,
  username,
  connectedEmailProviders = [],
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
  const [thankyouLayout, setThankyouLayout] = useState<ThankyouLayout>(existingFunnel?.thankyouLayout || 'survey_first');

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

  // GoHighLevel connection status
  const [ghlConnected, setGhlConnected] = useState(false);

  useEffect(() => {
    async function checkGHL() {
      try {
        const res = await fetch('/api/integrations/gohighlevel/status');
        if (res.ok) {
          const data = await res.json();
          setGhlConnected(data.connected === true);
        }
      } catch {
        // ignore - GHL section simply won't show
      }
    }
    checkGHL();
  }, []);

  // HeyReach connection status
  const [heyreachConnected, setHeyreachConnected] = useState(false);

  useEffect(() => {
    async function checkHeyReach() {
      try {
        const res = await fetch('/api/integrations/heyreach/status');
        if (res.ok) {
          const data = await res.json();
          setHeyreachConnected(data.connected === true);
        }
      } catch {
        // ignore - HeyReach section simply won't show
      }
    }
    checkHeyReach();
  }, []);

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
        thankyouLayout,
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

  // Build nav groups based on target type
  const navGroups: NavGroup[] = useMemo(() => [
    {
      title: 'Pages',
      items: [
        { id: 'optin', label: 'Opt-in Page', icon: FileText },
        { id: 'thankyou', label: 'Thank You', icon: CheckCircle2 },
      ],
    },
    {
      title: 'Design',
      items: [
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'sections', label: 'Sections', icon: LayoutGrid },
      ],
    },
    {
      title: 'Content',
      items: [
        ...(isLeadMagnetTarget ? [{ id: 'content' as TabType, label: 'Content', icon: PenLine }] : []),
        { id: 'questions', label: 'Survey', icon: ClipboardList },
      ],
    },
    {
      title: 'Delivery',
      items: [
        { id: 'email', label: 'Email', icon: Mail },
        { id: 'integrations', label: 'Integrations', icon: Plug },
      ],
    },
  ], [isLeadMagnetTarget]);

  // Find active group for mobile sub-tabs
  const activeGroup = navGroups.find(g => g.items.some(i => i.id === activeTab)) || navGroups[0];
  const isVisualTab = VISUAL_TABS.has(activeTab);

  function isTabComplete(tabId: TabType): boolean {
    switch (tabId) {
      case 'optin': return !!optinHeadline && optinHeadline !== targetTitle;
      case 'thankyou': return !!thankyouHeadline && thankyouHeadline !== 'Thanks! Check your email.';
      case 'theme': return true;
      case 'sections': return sections.length > 0;
      case 'content': return !!currentLeadMagnet?.polishedContent;
      case 'questions': return questions.length > 0;
      case 'email': return false;
      case 'integrations': return false;
      default: return false;
    }
  }

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
            const isActiveGroup = group.items.some(i => i.id === activeTab);
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
                          {complete && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />}
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

            {activeTab === 'integrations' && funnel && (
              <FunnelIntegrationsTab
                funnelPageId={funnel.id}
                connectedProviders={connectedEmailProviders}
                ghlConnected={ghlConnected}
                heyreachConnected={heyreachConnected}
                funnelUrl={username && slug ? `https://magnetlab.app/p/${username}/${slug}` : undefined}
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
              <PublishControls
                funnel={funnel}
                setFunnel={setFunnel}
                username={username}
              />
            )}

            <LeadDeliveryInfo />
          </div>
        )}
      </div>
    </div>
  );
}
