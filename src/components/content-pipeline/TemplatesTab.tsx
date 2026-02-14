'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Upload, Wand2, X } from 'lucide-react';
import type { PostTemplate } from '@/lib/types/content-pipeline';
import { CSVTemplateImporter } from './CSVTemplateImporter';
import { ViralPostsSection } from './ViralPostsSection';
import { StylesSection } from './StylesSection';

export function TemplatesTab() {
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | null>(null);

  // Create/edit form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStructure, setFormStructure] = useState('');
  const [formTags, setFormTags] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/content-pipeline/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch('/api/content-pipeline/templates/seed', { method: 'POST' });
      await fetchTemplates();
    } catch {
      // Silent failure
    } finally {
      setSeeding(false);
    }
  };

  const openEdit = (template: PostTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormCategory(template.category || '');
    setFormDescription(template.description || '');
    setFormStructure(template.structure);
    setFormTags((template.tags || []).join(', '));
    setShowCreate(true);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormCategory('');
    setFormDescription('');
    setFormStructure('');
    setFormTags('');
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!formName || !formStructure) return;
    setSaving(true);
    try {
      const body = {
        name: formName,
        category: formCategory || null,
        description: formDescription || null,
        structure: formStructure,
        tags: formTags ? formTags.split(',').map((t) => t.trim()).filter(Boolean) : null,
      };

      if (editingTemplate) {
        await fetch(`/api/content-pipeline/templates/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/content-pipeline/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      setShowCreate(false);
      await fetchTemplates();
    } catch {
      // Silent failure
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/content-pipeline/templates/${id}`, { method: 'DELETE' });
      await fetchTemplates();
    } catch {
      // Silent failure
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Templates Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Post Templates</h3>
          <div className="flex gap-2">
            {templates.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                Seed Defaults
              </button>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <Upload className="h-3 w-3" />
              Import CSV
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3 w-3" />
              New Template
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No templates yet. Seed defaults or create your own.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">{template.name}</h4>
                    {template.category && (
                      <span className="mt-0.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {template.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(template)}
                      className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="text-xs">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="rounded-lg p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {template.description && (
                  <p className="mb-2 text-xs text-muted-foreground">{template.description}</p>
                )}
                <pre className="max-h-24 overflow-hidden rounded bg-muted p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {template.structure}
                </pre>
                {template.tags && template.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.tags.map((tag) => (
                      <span key={tag} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Used {template.usage_count} times
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Template Editor">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 hover:bg-secondary" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select...</option>
                  <option value="story">Story</option>
                  <option value="framework">Framework</option>
                  <option value="listicle">Listicle</option>
                  <option value="contrarian">Contrarian</option>
                  <option value="case_study">Case Study</option>
                  <option value="question">Question</option>
                  <option value="educational">Educational</option>
                  <option value="motivational">Motivational</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Structure * (use [PLACEHOLDER] format)</label>
                <textarea
                  value={formStructure}
                  onChange={(e) => setFormStructure(e.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="storytelling, data-driven, hooks"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName || !formStructure}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <CSVTemplateImporter
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            fetchTemplates();
          }}
        />
      )}

      {/* Viral Posts Section */}
      <ViralPostsSection onTemplateExtracted={fetchTemplates} />

      {/* Styles Section */}
      <StylesSection />
    </div>
  );
}
