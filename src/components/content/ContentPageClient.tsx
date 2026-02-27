'use client';

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ContentHeader } from './ContentHeader';
import { ContentHero } from './ContentHero';
import { TableOfContents } from './TableOfContents';
import { PolishedContentRenderer } from './PolishedContentRenderer';
import { InlineContentEditor } from './inline-editor';
import { ExtractedContentRenderer } from './ExtractedContentRenderer';
import { ContentFooter } from './ContentFooter';
import { VideoEmbed } from '@/components/funnel/public/VideoEmbed';
import { BookCallDrawer } from './BookCallDrawer';
import { getThemeVars } from '@/lib/utils/theme-vars';
import { SectionRenderer } from '@/components/ds';
import { FontLoader, getFontStyle } from '@/components/funnel/public/FontLoader';
import { CalculatorTool } from '@/components/interactive/public/CalculatorTool';
import { AssessmentTool } from '@/components/interactive/public/AssessmentTool';
import { GPTChatTool } from '@/components/interactive/public/GPTChatTool';
import type { PolishedContent, ExtractedContent, LeadMagnetConcept, InteractiveConfig } from '@/lib/types/lead-magnet';
import type { FunnelPageSection } from '@/lib/types/funnel';

interface ContentPageClientProps {
  title: string;
  polishedContent: PolishedContent | null;
  extractedContent: ExtractedContent | null;
  concept: LeadMagnetConcept | null;
  thumbnailUrl: string | null;
  theme: 'dark' | 'light';
  primaryColor: string;
  logoUrl: string | null;
  fontFamily?: string | null;
  fontUrl?: string | null;
  vslUrl: string | null;
  calendlyUrl: string | null;
  isOwner?: boolean;
  leadMagnetId?: string;
  funnelPageId?: string;
  leadId?: string | null;
  isQualified?: boolean | null;
  hasQuestions?: boolean;
  interactiveConfig?: InteractiveConfig | null;
  sections?: FunnelPageSection[];
  hideBranding?: boolean;
  autoEdit?: boolean;
}

export function ContentPageClient({
  title,
  polishedContent,
  extractedContent,
  theme: initialTheme,
  primaryColor,
  logoUrl,
  fontFamily,
  fontUrl,
  vslUrl,
  calendlyUrl,
  isOwner = false,
  leadMagnetId,
  funnelPageId,
  leadId,
  isQualified = null,
  hasQuestions = false,
  interactiveConfig,
  sections = [],
  hideBranding,
  autoEdit = false,
}: ContentPageClientProps) {
  const [isDark, setIsDark] = useState(initialTheme === 'dark');
  const [isEditing, setIsEditing] = useState(autoEdit && isOwner);
  const [editContent, setEditContent] = useState<PolishedContent | null>(polishedContent);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const theme = isDark ? 'dark' : 'light';
  const themeVars = getThemeVars(theme as 'dark' | 'light', primaryColor);
  const bgColor = isDark ? '#09090B' : '#FAFAFA';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const textColor = isDark ? '#FAFAFA' : '#09090B';

  // Split sections into above-content and below-content slots
  const aboveSections = sections.filter(s => s.sortOrder < 50);
  const belowSections = sections.filter(s => s.sortOrder >= 50);

  // The content to display (edited or original)
  const displayContent = isEditing ? editContent : polishedContent;

  // Build TOC sections
  const tocSections = displayContent
    ? displayContent.sections.map((s) => ({ id: `section-${s.id}`, name: s.sectionName }))
    : extractedContent
      ? extractedContent.structure.map((s, i) => ({ id: `section-${i}`, name: s.sectionName }))
      : [];

  const heroSummary = displayContent?.heroSummary || null;
  const readingTime = displayContent?.metadata?.readingTimeMinutes || null;
  const wordCount = displayContent?.metadata?.wordCount || null;

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Discard changes
      setEditContent(polishedContent);
    }
    setIsEditing(!isEditing);
    setSaveError(null);
  }, [isEditing, polishedContent]);

  const handleSave = async () => {
    if (!editContent || !leadMagnetId) return;
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/lead-magnet/${leadMagnetId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polishedContent: editContent }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Exit edit mode after successful save
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Show sticky CTA when calendly is configured, user has a leadId, and not in edit mode
  const showStickyCta = !!calendlyUrl && !!leadId && !!funnelPageId && !isEditing;

  if (interactiveConfig) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-white text-gray-900'}`}>
        <div className="mx-auto max-w-3xl px-4 py-12">
          {interactiveConfig.type === 'calculator' && (
            <CalculatorTool config={interactiveConfig} theme={theme} primaryColor={primaryColor} />
          )}
          {interactiveConfig.type === 'assessment' && (
            <AssessmentTool config={interactiveConfig} theme={theme} primaryColor={primaryColor} />
          )}
          {interactiveConfig.type === 'gpt' && (
            <GPTChatTool config={interactiveConfig} leadMagnetId={leadMagnetId!} theme={theme} primaryColor={primaryColor} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bgColor, minHeight: '100vh', paddingBottom: showStickyCta ? '5rem' : undefined, ...themeVars, ...getFontStyle(fontFamily) }}>
      <FontLoader fontFamily={fontFamily || null} fontUrl={fontUrl || null} />
      <ContentHeader
        logoUrl={logoUrl}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        isOwner={isOwner}
        isEditing={isEditing}
        onToggleEdit={polishedContent ? handleToggleEdit : undefined}
      />

      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        {/* Hero */}
        <div style={{ maxWidth: '700px' }}>
          <ContentHero
            title={title}
            heroSummary={heroSummary}
            readingTimeMinutes={readingTime}
            wordCount={wordCount}
            isDark={isDark}
          />
        </div>

        {/* Video */}
        {vslUrl && (
          <div style={{ maxWidth: '700px', marginBottom: '2.5rem' }}>
            <VideoEmbed url={vslUrl} />
          </div>
        )}

        {/* Above-content sections */}
        {aboveSections.length > 0 && (
          <div style={{ maxWidth: '700px', marginBottom: '2.5rem' }} className="space-y-6">
            {aboveSections.map(s => <SectionRenderer key={s.id} section={s} />)}
          </div>
        )}

        {/* TOC + Content layout */}
        <div style={{ display: 'flex', gap: '3rem' }}>
          {/* Main content */}
          <div style={{ maxWidth: '700px', flex: 1, minWidth: 0 }}>
            {isEditing && editContent ? (
              <InlineContentEditor
                content={editContent}
                isDark={isDark}
                primaryColor={primaryColor}
                onChange={setEditContent}
              />
            ) : displayContent ? (
              <PolishedContentRenderer
                content={displayContent}
                isDark={isDark}
                primaryColor={primaryColor}
              />
            ) : extractedContent ? (
              <ExtractedContentRenderer
                content={extractedContent}
                isDark={isDark}
              />
            ) : null}
          </div>

          {/* TOC sidebar */}
          {!isEditing && tocSections.length > 1 && (
            <TableOfContents
              sections={tocSections}
              isDark={isDark}
              primaryColor={primaryColor}
            />
          )}
        </div>
      </div>

      {/* Below-content sections */}
      {belowSections.length > 0 && (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 1.5rem' }} className="space-y-6">
          {belowSections.map(s => <SectionRenderer key={s.id} section={s} />)}
        </div>
      )}

      <ContentFooter isDark={isDark} hideBranding={hideBranding} />

      {/* Edit mode save bar */}
      {isEditing && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: isDark ? 'rgba(9,9,11,0.95)' : 'rgba(250,250,250,0.95)',
            borderTop: `1px solid ${borderColor}`,
            backdropFilter: 'blur(12px)',
            padding: '0.75rem 1.5rem',
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {saveError && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{saveError}</p>
              )}
              {!saveError && (
                <p style={{ color: isDark ? '#A1A1AA' : '#71717A', fontSize: '0.875rem' }}>
                  Editing mode — changes are not saved until you click Save
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleToggleEdit}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: textColor,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: primaryColor,
                  color: '#FFFFFF',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Book-a-Call CTA */}
      {showStickyCta && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: isDark ? 'rgba(9,9,11,0.95)' : 'rgba(250,250,250,0.95)',
            borderTop: `1px solid ${borderColor}`,
            backdropFilter: 'blur(12px)',
            padding: '0.75rem 1.5rem',
          }}
        >
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: primaryColor,
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Book a Call
            </button>
          </div>
        </div>
      )}

      {/* Book Call Drawer */}
      {showStickyCta && funnelPageId && leadId && (
        <BookCallDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          calendlyUrl={calendlyUrl!}
          funnelPageId={funnelPageId}
          leadId={leadId}
          isQualified={isQualified ?? null}
          hasQuestions={hasQuestions}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
}
