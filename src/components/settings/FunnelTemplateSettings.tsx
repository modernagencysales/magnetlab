'use client';

import { useState } from 'react';
import { Loader2, Check, Layout, Sparkles, Award, Layers } from 'lucide-react';
import { FUNNEL_TEMPLATES } from '@/lib/constants/funnel-templates';

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  minimal: <Layout className="h-5 w-5" />,
  social_proof: <Sparkles className="h-5 w-5" />,
  authority: <Award className="h-5 w-5" />,
  full_suite: <Layers className="h-5 w-5" />,
};

interface FunnelTemplateSettingsProps {
  currentTemplate: string;
  onSaved: (templateId: string) => void;
}

export function FunnelTemplateSettings({ currentTemplate, onSaved }: FunnelTemplateSettingsProps) {
  const [selected, setSelected] = useState(currentTemplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (templateId: string) => {
    if (templateId === selected) return;
    setSelected(templateId);
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/user/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultFunnelTemplate: templateId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      onSaved(templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSelected(currentTemplate);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Default Funnel Template</h3>
        <p className="text-sm text-muted-foreground">
          New funnels will use this template to pre-populate page sections. You can customize sections per funnel afterward.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FUNNEL_TEMPLATES.map(template => {
          const isSelected = selected === template.id;
          const sectionCount = template.sections.length;
          return (
            <button
              key={template.id}
              onClick={() => handleSelect(template.id)}
              disabled={saving}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              } disabled:opacity-50`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground">{TEMPLATE_ICONS[template.id]}</span>
                <span className="font-medium">{template.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {sectionCount === 0 ? 'No sections' : `${sectionCount} section${sectionCount !== 1 ? 's' : ''} across pages`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
