'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff, GripVertical, ChevronDown } from 'lucide-react';
import type { FunnelPageSection, SectionType, PageLocation, LogoBarConfig, StepsConfig, TestimonialConfig, MarketingBlockConfig, SectionBridgeConfig } from '@/lib/types/funnel';

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
];

const PAGE_LOCATIONS: { value: PageLocation; label: string }[] = [
  { value: 'optin', label: 'Opt-in' },
  { value: 'thankyou', label: 'Thank You' },
  { value: 'content', label: 'Content' },
];

function getDefaultConfig(type: SectionType): LogoBarConfig | StepsConfig | TestimonialConfig | MarketingBlockConfig | SectionBridgeConfig {
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
  }
}

export function SectionsManager({ funnelId, sections, onSectionsChange }: SectionsManagerProps) {
  const [activeLocation, setActiveLocation] = useState<PageLocation>('optin');
  const [addingType, setAddingType] = useState<SectionType | null>(null);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);


  const filteredSections = sections
    .filter(s => s.pageLocation === activeLocation)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAdd = async () => {
    if (!funnelId || !addingType) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/funnel/${funnelId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: addingType,
          pageLocation: activeLocation,
          config: getDefaultConfig(addingType),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSectionsChange([...sections, data.section]);
        setAddingType(null);
        setExpandedId(data.section.id);
      }
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const handleToggleVisibility = async (section: FunnelPageSection) => {
    if (!funnelId) return;
    setSavingId(section.id);
    try {
      const res = await fetch(`/api/funnel/${funnelId}/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !section.isVisible }),
      });
      if (res.ok) {
        const data = await res.json();
        onSectionsChange(sections.map(s => s.id === section.id ? data.section : s));
      }
    } catch {
      // ignore
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (sectionId: string) => {
    if (!funnelId) return;
    setDeletingId(sectionId);
    try {
      const res = await fetch(`/api/funnel/${funnelId}/sections/${sectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onSectionsChange(sections.filter(s => s.id !== sectionId));
        if (expandedId === sectionId) setExpandedId(null);
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateConfig = async (section: FunnelPageSection, newConfig: Record<string, unknown>) => {
    if (!funnelId) return;
    setSavingId(section.id);
    try {
      const res = await fetch(`/api/funnel/${funnelId}/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig }),
      });
      if (res.ok) {
        const data = await res.json();
        onSectionsChange(sections.map(s => s.id === section.id ? data.section : s));
      }
    } catch {
      // ignore
    } finally {
      setSavingId(null);
    }
  };

  const handleResetToTemplate = async () => {
    if (!funnelId) return;
    if (!confirm(`This will replace all ${PAGE_LOCATIONS.find(l => l.value === activeLocation)?.label} sections with the template defaults. Continue?`)) return;

    setResetting(true);
    try {
      const res = await fetch(`/api/funnel/${funnelId}/sections/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageLocation: activeLocation }),
      });

      if (res.ok) {
        const data = await res.json();
        const otherSections = sections.filter(s => s.pageLocation !== activeLocation);
        onSectionsChange([...otherSections, ...data.sections]);
      }
    } catch {
      // ignore
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
        Add design system sections to your funnel pages. Sections with sort order below 50 appear above the main content, 50+ appear below.
      </p>

      {/* Page location pills */}
      <div className="flex gap-2">
        {PAGE_LOCATIONS.map(loc => (
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

          {filteredSections.map(section => (
            <div
              key={section.id}
              className="rounded-lg border bg-card"
            >
              {/* Section header row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <button
                  onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
                  className="flex-1 flex items-center gap-2 text-left text-sm font-medium"
                >
                  <span>{SECTION_TYPES.find(t => t.value === section.sectionType)?.label || section.sectionType}</span>
                  <span className="text-xs text-muted-foreground">#{section.sortOrder}</span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedId === section.id ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={() => handleToggleVisibility(section)}
                  disabled={savingId === section.id}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title={section.isVisible ? 'Hide' : 'Show'}
                >
                  {section.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleDelete(section.id)}
                  disabled={deletingId === section.id}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  {deletingId === section.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Expanded config editor */}
              {expandedId === section.id && (
                <div className="border-t px-3 py-3">
                  <SectionConfigEditor
                    section={section}
                    saving={savingId === section.id}
                    onSave={(config) => handleUpdateConfig(section, config)}
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
          onChange={(e) => setAddingType(e.target.value as SectionType || null)}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select section type...</option>
          {SECTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!addingType || adding}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>

      {/* Reset to template */}
      <button
        onClick={handleResetToTemplate}
        disabled={resetting}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Reset to template defaults
      </button>
    </div>
  );
}

// --- Config editors per section type ---

interface SectionConfigEditorProps {
  section: FunnelPageSection;
  saving: boolean;
  onSave: (config: Record<string, unknown>) => void;
}

function SectionConfigEditor({ section, saving, onSave }: SectionConfigEditorProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(section.config as unknown as Record<string, unknown>);

  const handleSave = () => onSave(config);

  return (
    <div className="space-y-3">
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
        <MarketingBlockEditor config={config as unknown as MarketingBlockConfig} onChange={setConfig} />
      )}
      {section.sectionType === 'section_bridge' && (
        <SectionBridgeEditor config={config as unknown as SectionBridgeConfig} onChange={setConfig} />
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
        <span className="ml-2 text-xs text-muted-foreground">(&lt; 50 = above, &ge; 50 = below)</span>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        Save Config
      </button>
    </div>
  );
}

// --- Per-type config editors ---

function FieldInput({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded border bg-background px-2 py-1 text-sm resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}

function LogoBarEditor({ config, onChange }: { config: LogoBarConfig; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">Logos (one per line: name | imageUrl)</label>
      <textarea
        value={(config.logos || []).map(l => `${l.name}|${l.imageUrl}`).join('\n')}
        onChange={e => {
          const logos = e.target.value.split('\n').filter(Boolean).map(line => {
            const [name, imageUrl] = line.split('|').map(s => s.trim());
            return { name: name || '', imageUrl: imageUrl || '' };
          });
          onChange({ ...config, logos });
        }}
        rows={4}
        className="w-full rounded border bg-background px-2 py-1 text-sm font-mono resize-none"
        placeholder="Company Name | https://logo-url.com/logo.svg"
      />
    </div>
  );
}

function StepsEditor({ config, onChange }: { config: StepsConfig; onChange: (c: Record<string, unknown>) => void }) {
  const steps = config.steps || [];
  const updateStep = (idx: number, field: string, value: string) => {
    const newSteps = steps.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    onChange({ ...config, steps: newSteps });
  };

  return (
    <>
      <FieldInput label="Heading" value={config.heading || ''} onChange={v => onChange({ ...config, heading: v })} placeholder="What Happens Next" />
      <FieldInput label="Subheading" value={config.subheading || ''} onChange={v => onChange({ ...config, subheading: v })} placeholder="Optional subheading" />
      {steps.map((step, i) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <FieldInput label={`Step ${i + 1} Title`} value={step.title} onChange={v => updateStep(i, 'title', v)} />
          <FieldInput label="Description" value={step.description} onChange={v => updateStep(i, 'description', v)} />
        </div>
      ))}
    </>
  );
}

function TestimonialEditor({ config, onChange }: { config: TestimonialConfig; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <FieldInput label="Quote" value={config.quote} onChange={v => onChange({ ...config, quote: v })} multiline />
      <FieldInput label="Author" value={config.author || ''} onChange={v => onChange({ ...config, author: v })} />
      <FieldInput label="Role" value={config.role || ''} onChange={v => onChange({ ...config, role: v })} placeholder="CEO at Company" />
      <FieldInput label="Result" value={config.result || ''} onChange={v => onChange({ ...config, result: v })} placeholder="2x revenue in 3 months" />
    </>
  );
}

function MarketingBlockEditor({ config, onChange }: { config: MarketingBlockConfig; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground">Block Type</label>
        <select
          value={config.blockType}
          onChange={e => onChange({ ...config, blockType: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        >
          {['testimonial', 'case_study', 'feature', 'benefit', 'faq', 'pricing', 'cta'].map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
      </div>
      <FieldInput label="Title" value={config.title || ''} onChange={v => onChange({ ...config, title: v })} />
      <FieldInput label="Content" value={config.content || ''} onChange={v => onChange({ ...config, content: v })} multiline />
      {config.blockType === 'cta' && (
        <>
          <FieldInput label="CTA Text" value={config.ctaText || ''} onChange={v => onChange({ ...config, ctaText: v })} placeholder="Get Started" />
          <FieldInput label="CTA URL" value={config.ctaUrl || ''} onChange={v => onChange({ ...config, ctaUrl: v })} placeholder="https://..." />
        </>
      )}
    </>
  );
}

function SectionBridgeEditor({ config, onChange }: { config: SectionBridgeConfig; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <FieldInput label="Text" value={config.text} onChange={v => onChange({ ...config, text: v })} />
      <div>
        <label className="text-xs text-muted-foreground">Variant</label>
        <select
          value={config.variant || 'default'}
          onChange={e => onChange({ ...config, variant: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        >
          <option value="default">Default</option>
          <option value="accent">Accent</option>
          <option value="gradient">Gradient</option>
        </select>
      </div>
      <FieldInput label="Step Label" value={config.stepLabel || ''} onChange={v => onChange({ ...config, stepLabel: v })} placeholder="Step 2" />
    </>
  );
}
