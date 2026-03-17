/** SectionsManager. CRUD + config editing for funnel page sections. Editors extracted to section-editors/. */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Eye, EyeOff, GripVertical, ChevronDown } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import type {
  FunnelPageSection,
  SectionType,
  SectionConfig,
  PageLocation,
  LogoBarConfig,
  StepsConfig,
  TestimonialConfig,
  MarketingBlockConfig,
  SectionBridgeConfig,
  HeroConfig,
  StatsBarConfig,
  FeatureGridConfig,
  SocialProofWallConfig,
} from '@/lib/types/funnel';
import { SECTION_VARIANTS } from '@/lib/types/funnel';
import * as funnelApi from '@/frontend/api/funnel';
import {
  LogoBarEditor,
  StepsEditor,
  TestimonialEditor,
  MarketingBlockEditor,
  SectionBridgeEditor,
  HeroEditor,
  StatsBarEditor,
  FeatureGridEditor,
  SocialProofWallEditor,
} from './section-editors';

// ─── Constants ─────────────────────────────────────────

interface SectionsManagerProps {
  funnelId: string | null;
  sections: FunnelPageSection[];
  onSectionsChange: (sections: FunnelPageSection[]) => void;
}

const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: 'logo_bar', label: 'Logo Bar' },
  { value: 'steps', label: 'Simple Steps' },
  { value: 'testimonial', label: 'Testimonial Quote' },
  { value: 'marketing_block', label: 'Marketing Block' },
  { value: 'section_bridge', label: 'Section Bridge' },
  { value: 'hero', label: 'Hero' },
  { value: 'stats_bar', label: 'Stats Bar' },
  { value: 'feature_grid', label: 'Feature Grid' },
  { value: 'social_proof_wall', label: 'Social Proof Wall' },
];

const PAGE_LOCATIONS: { value: PageLocation; label: string }[] = [
  { value: 'optin', label: 'Opt-in' },
  { value: 'thankyou', label: 'Thank You' },
  { value: 'content', label: 'Content' },
];

// ─── Default Configs ───────────────────────────────────

function getDefaultConfig(type: SectionType): SectionConfig {
  switch (type) {
    case 'logo_bar':
      return { logos: [] } satisfies LogoBarConfig;
    case 'steps':
      return {
        heading: 'What Happens Next',
        steps: [
          { title: 'Step 1', description: 'Description' },
          { title: 'Step 2', description: 'Description' },
          { title: 'Step 3', description: 'Description' },
        ],
      } satisfies StepsConfig;
    case 'testimonial':
      return {
        quote: 'This was incredibly helpful.',
        author: 'Jane Doe',
        role: 'CEO at Company',
      } satisfies TestimonialConfig;
    case 'marketing_block':
      return {
        blockType: 'feature',
        title: 'Feature Headline',
        content: 'Feature description goes here.',
      } satisfies MarketingBlockConfig;
    case 'section_bridge':
      return {
        text: 'Ready for the next step?',
        variant: 'default',
      } satisfies SectionBridgeConfig;
    case 'hero':
      return {
        headline: 'Your Headline Here',
      } satisfies HeroConfig;
    case 'stats_bar':
      return {
        items: [
          { value: '100+', label: 'Clients' },
          { value: '50+', label: 'Projects' },
          { value: '99%', label: 'Satisfaction' },
        ],
      } satisfies StatsBarConfig;
    case 'feature_grid':
      return {
        features: [
          { icon: 'star', title: 'Feature One', description: 'Description of the first feature' },
          { icon: 'zap', title: 'Feature Two', description: 'Description of the second feature' },
          {
            icon: 'shield',
            title: 'Feature Three',
            description: 'Description of the third feature',
          },
        ],
      } satisfies FeatureGridConfig;
    case 'social_proof_wall':
      return {
        testimonials: [
          {
            quote: 'This completely changed how I approach my business. Highly recommend.',
            author: 'Jane Doe',
          },
          {
            quote: 'The results speak for themselves. Worth every minute invested.',
            author: 'John Smith',
          },
        ],
      } satisfies SocialProofWallConfig;
  }
}

// ─── Main Component ────────────────────────────────────

export function SectionsManager({ funnelId, sections, onSectionsChange }: SectionsManagerProps) {
  const [activeLocation, setActiveLocation] = useState<PageLocation>('optin');
  const [addingType, setAddingType] = useState<SectionType | null>(null);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const filteredSections = sections
    .filter((s) => s.pageLocation === activeLocation)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAdd = async () => {
    if (!funnelId || !addingType) return;
    setAdding(true);
    try {
      const data = await funnelApi.createSection(funnelId, {
        sectionType: addingType,
        pageLocation: activeLocation,
        config: getDefaultConfig(addingType),
      });
      const section = data.section as FunnelPageSection;
      onSectionsChange([...sections, section]);
      setAddingType(null);
      setExpandedId(section.id);
    } catch (err) {
      console.error('SectionsManager.handleAdd', err);
      toast.error('Failed to add section');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleVisibility = async (section: FunnelPageSection) => {
    if (!funnelId) return;
    setSavingId(section.id);
    try {
      const data = await funnelApi.updateSection(funnelId, section.id, {
        isVisible: !section.isVisible,
      });
      onSectionsChange(
        sections.map((s) => (s.id === section.id ? (data.section as FunnelPageSection) : s))
      );
    } catch (err) {
      console.error('SectionsManager.handleToggleVisibility', err);
      toast.error('Failed to update section visibility');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (sectionId: string) => {
    if (!funnelId) return;
    setDeletingId(sectionId);
    try {
      await funnelApi.deleteSection(funnelId, sectionId);
      onSectionsChange(sections.filter((s) => s.id !== sectionId));
      if (expandedId === sectionId) setExpandedId(null);
    } catch (err) {
      console.error('SectionsManager.handleDelete', err);
      toast.error('Failed to delete section');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateConfig = async (
    section: FunnelPageSection,
    newConfig: Record<string, unknown>
  ) => {
    if (!funnelId) return;
    setSavingId(section.id);
    try {
      const data = await funnelApi.updateSection(funnelId, section.id, { config: newConfig });
      onSectionsChange(
        sections.map((s) => (s.id === section.id ? (data.section as FunnelPageSection) : s))
      );
    } catch (err) {
      console.error('SectionsManager.handleUpdateConfig', err);
      toast.error('Failed to save section config');
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateVariant = async (section: FunnelPageSection, variant: string) => {
    if (!funnelId) return;
    setSavingId(section.id);
    try {
      const data = await funnelApi.updateSection(funnelId, section.id, { variant });
      onSectionsChange(
        sections.map((s) => (s.id === section.id ? (data.section as FunnelPageSection) : s))
      );
    } catch (err) {
      console.error('SectionsManager.handleUpdateVariant', err);
      toast.error('Failed to update section variant');
    } finally {
      setSavingId(null);
    }
  };

  const handleResetToTemplate = async () => {
    if (!funnelId) return;
    if (
      !confirm(
        `This will replace all ${PAGE_LOCATIONS.find((l) => l.value === activeLocation)?.label} sections with the template defaults. Continue?`
      )
    )
      return;

    setResetting(true);
    try {
      const data = await funnelApi.resetSections(funnelId, activeLocation);
      const otherSections = sections.filter((s) => s.pageLocation !== activeLocation);
      onSectionsChange([...otherSections, ...(data.sections as FunnelPageSection[])]);
    } catch (err) {
      console.error('SectionsManager.handleResetToTemplate', err);
      toast.error('Failed to reset sections to template');
    } finally {
      setResetting(false);
    }
  };

  if (!funnelId) {
    return (
      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        Save your funnel first to manage sections.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add design system sections to your funnel pages. Sections with sort order below 50 appear
        above the main content, 50+ appear below.
      </p>

      {/* Page location pills */}
      <div className="flex gap-2">
        {PAGE_LOCATIONS.map((loc) => (
          <button
            key={loc.value}
            onClick={() => setActiveLocation(loc.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              activeLocation === loc.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {loc.label}
          </button>
        ))}
      </div>

      {/* Section list */}
      <div className="space-y-2">
        {filteredSections.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No sections on this page yet.
          </div>
        )}

        {filteredSections.map((section) => (
          <div key={section.id} className="rounded-lg border bg-card">
            {/* Section header row */}
            <div className="flex items-center gap-2 px-3 py-2">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <button
                onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
                className="flex-1 flex items-center gap-2 text-left text-sm font-medium"
              >
                <span>
                  {SECTION_TYPES.find((t) => t.value === section.sectionType)?.label ||
                    section.sectionType}
                </span>
                <span className="text-xs text-muted-foreground">#{section.sortOrder}</span>
                <ChevronDown
                  className={`h-3 w-3 text-muted-foreground transition-transform ${expandedId === section.id ? 'rotate-180' : ''}`}
                />
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleToggleVisibility(section)}
                disabled={savingId === section.id}
                title={section.isVisible ? 'Hide' : 'Show'}
              >
                {section.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(section.id)}
                disabled={deletingId === section.id}
                className="text-muted-foreground hover:text-destructive"
                title="Delete"
              >
                {deletingId === section.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Expanded config editor */}
            {expandedId === section.id && (
              <div className="border-t px-3 py-3">
                <SectionConfigEditor
                  section={section}
                  saving={savingId === section.id}
                  onSave={(config) => handleUpdateConfig(section, config)}
                  onVariantChange={(variant) => handleUpdateVariant(section, variant)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add section */}
      <div className="flex gap-2">
        <select
          value={addingType || ''}
          onChange={(e) => setAddingType((e.target.value as SectionType) || null)}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select section type...</option>
          {SECTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <Button onClick={handleAdd} disabled={!addingType || adding}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>

      {/* Reset to template */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleResetToTemplate}
        disabled={resetting}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Reset to template defaults
      </Button>
    </div>
  );
}

// ─── Config Editor Wrapper ─────────────────────────────

interface SectionConfigEditorProps {
  section: FunnelPageSection;
  saving: boolean;
  onSave: (config: Record<string, unknown>) => void;
  onVariantChange: (variant: string) => void;
}

function SectionConfigEditor({
  section,
  saving,
  onSave,
  onVariantChange,
}: SectionConfigEditorProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    section.config as unknown as Record<string, unknown>
  );

  const handleSave = () => onSave(config);
  const variants = SECTION_VARIANTS[section.sectionType as SectionType] || [];

  return (
    <div className="space-y-3">
      {/* Variant selector */}
      {variants.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">Variant</label>
          <select
            value={section.variant || variants[0]}
            onChange={(e) => onVariantChange(e.target.value)}
            className="w-full rounded border bg-background px-2 py-1 text-sm"
          >
            {variants.map((v) => (
              <option key={v} value={v}>
                {v
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Type-specific config editor */}
      {section.sectionType === 'logo_bar' && (
        <LogoBarEditor config={config as unknown as LogoBarConfig} onChange={setConfig} />
      )}
      {section.sectionType === 'steps' && (
        <StepsEditor config={config as unknown as StepsConfig} onChange={setConfig} />
      )}
      {section.sectionType === 'testimonial' && (
        <TestimonialEditor config={config as unknown as TestimonialConfig} onChange={setConfig} />
      )}
      {section.sectionType === 'marketing_block' && (
        <MarketingBlockEditor
          config={config as unknown as MarketingBlockConfig}
          onChange={setConfig}
        />
      )}
      {section.sectionType === 'section_bridge' && (
        <SectionBridgeEditor
          config={config as unknown as SectionBridgeConfig}
          onChange={setConfig}
        />
      )}
      {section.sectionType === 'hero' && (
        <HeroEditor config={config as unknown as HeroConfig} onChange={setConfig} />
      )}
      {section.sectionType === 'stats_bar' && (
        <StatsBarEditor config={config as unknown as StatsBarConfig} onChange={setConfig} />
      )}
      {section.sectionType === 'feature_grid' && (
        <FeatureGridEditor config={config as unknown as FeatureGridConfig} onChange={setConfig} />
      )}
      {section.sectionType === 'social_proof_wall' && (
        <SocialProofWallEditor
          config={config as unknown as SocialProofWallConfig}
          onChange={setConfig}
        />
      )}

      {/* Sort order */}
      <div>
        <label className="text-xs text-muted-foreground">Sort Order</label>
        <input
          type="number"
          value={section.sortOrder}
          disabled
          className="w-20 rounded border bg-muted px-2 py-1 text-sm"
        />
        <span className="ml-2 text-xs text-muted-foreground">
          (&lt; 50 = above, &ge; 50 = below)
        </span>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        Save Config
      </Button>
    </div>
  );
}
