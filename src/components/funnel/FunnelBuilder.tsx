'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { OptinPageEditor } from './OptinPageEditor';
import { ThankyouPageEditor } from './ThankyouPageEditor';
import { QuestionsManager } from './QuestionsManager';
import { FunnelPreview } from './FunnelPreview';
import { PublishControls } from './PublishControls';
import type { FunnelPage, QualificationQuestion, GeneratedOptinContent } from '@/lib/types/funnel';
import type { LeadMagnet } from '@/lib/types/lead-magnet';

interface FunnelBuilderProps {
  leadMagnet: LeadMagnet;
  existingFunnel: FunnelPage | null;
  existingQuestions: QualificationQuestion[];
  username: string | null;
}

type TabType = 'optin' | 'thankyou' | 'questions';

export function FunnelBuilder({
  leadMagnet,
  existingFunnel,
  existingQuestions,
  username,
}: FunnelBuilderProps) {
  const [activeTab, setActiveTab] = useState<TabType>('optin');
  const [funnel, setFunnel] = useState<FunnelPage | null>(existingFunnel);
  const [questions, setQuestions] = useState<QualificationQuestion[]>(existingQuestions);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for opt-in page
  const [optinHeadline, setOptinHeadline] = useState(existingFunnel?.optinHeadline || leadMagnet.title);
  const [optinSubline, setOptinSubline] = useState(existingFunnel?.optinSubline || '');
  const [optinButtonText, setOptinButtonText] = useState(existingFunnel?.optinButtonText || 'Get Free Access');
  const [optinSocialProof, setOptinSocialProof] = useState(existingFunnel?.optinSocialProof || '');
  const [slug, setSlug] = useState(existingFunnel?.slug || generateSlug(leadMagnet.title));

  // Form state for thank-you page
  const [thankyouHeadline, setThankyouHeadline] = useState(existingFunnel?.thankyouHeadline || 'Thanks! Check your email.');
  const [thankyouSubline, setThankyouSubline] = useState(existingFunnel?.thankyouSubline || '');
  const [vslUrl, setVslUrl] = useState(existingFunnel?.vslUrl || '');
  const [calendlyUrl, setCalendlyUrl] = useState(existingFunnel?.calendlyUrl || '');
  const [qualificationPassMessage, setQualificationPassMessage] = useState(existingFunnel?.qualificationPassMessage || 'Great! Book a call below.');
  const [qualificationFailMessage, setQualificationFailMessage] = useState(existingFunnel?.qualificationFailMessage || 'Thanks for your interest!');

  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  const handleGenerateContent = async () => {
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
      const payload = {
        leadMagnetId: leadMagnet.id,
        slug,
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
      };

      let response;
      if (funnel) {
        // Update existing
        response = await fetch(`/api/funnel/${funnel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new
        response = await fetch('/api/funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const data = await response.json();
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

  const tabs = [
    { id: 'optin' as const, label: 'Opt-in Page' },
    { id: 'thankyou' as const, label: 'Thank-you Page' },
    { id: 'questions' as const, label: 'Qualification' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor Panel */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Funnel Page Builder</h1>
          {!funnel && (
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
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
            />
          )}

          {activeTab === 'questions' && (
            <QuestionsManager
              funnelId={funnel?.id || null}
              questions={questions}
              setQuestions={setQuestions}
              onNeedsSave={() => {
                if (!funnel) {
                  handleSave();
                }
              }}
            />
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <a
            href="/library"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Library
          </a>
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
        />

        {funnel && (
          <PublishControls
            funnel={funnel}
            setFunnel={setFunnel}
            username={username}
          />
        )}
      </div>
    </div>
  );
}
