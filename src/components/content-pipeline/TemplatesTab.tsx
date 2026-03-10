'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Upload, Wand2, X, Globe, User, Check } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@magnetlab/magnetui';
import type { PostTemplate } from '@/lib/types/content-pipeline';
import * as templatesApi from '@/frontend/api/content-pipeline/templates';
import { CSVTemplateImporter } from './CSVTemplateImporter';
import { ViralPostsSection } from './ViralPostsSection';
import { StylesSection } from './StylesSection';
import { TemplateSearch } from './TemplateSearch';
import { GlobalTemplateLibrary } from './GlobalTemplateLibrary';
import { TrackedCreators } from './TrackedCreators';

export function TemplatesTab() {
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | null>(null);
  const [activeSection, setActiveSection] = useState<'global' | 'mine'>('global');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create/edit form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStructure, setFormStructure] = useState('');
  const [formTags, setFormTags] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const list = await templatesApi.listTemplates('mine');
      setTemplates((list || []) as PostTemplate[]);
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
      await templatesApi.seedTemplates();
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
        tags: formTags
          ? formTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : null,
      };

      if (editingTemplate) {
        await templatesApi.updateTemplate(editingTemplate.id, body);
      } else {
        await templatesApi.createTemplate({
          name: formName,
          category: formCategory || null,
          description: formDescription || null,
          structure: formStructure,
          tags: body.tags ?? undefined,
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
      await templatesApi.deleteTemplate(id);
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
      {/* Semantic Search */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
          Find Templates
        </h3>
        <TemplateSearch />
      </div>

      {/* Section Toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveSection('global')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeSection === 'global'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="h-3 w-3" />
          Global Library
        </button>
        <button
          onClick={() => setActiveSection('mine')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeSection === 'mine'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="h-3 w-3" />
          My Templates
        </button>
      </div>

      {/* Global Library Section */}
      {activeSection === 'global' && (
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
            Global Template Library
          </h3>
          <GlobalTemplateLibrary />
        </div>
      )}

      {/* My Templates Section */}
      {activeSection === 'mine' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">My Templates</h3>
            <div className="flex gap-2">
              {templates.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
                  {seeding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Seed Defaults
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                <Upload className="h-3 w-3" />
                Import CSV
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-3 w-3" />
                New Template
              </Button>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No templates yet. Seed defaults or create your own.
              </p>
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
                      <Button
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await navigator.clipboard.writeText(template.structure);
                          setCopiedId(template.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                      >
                        {copiedId === template.id ? (
                          <>
                            <Check className="h-3 w-3" /> Copied
                          </>
                        ) : (
                          'Use This'
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(template)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <X className="h-3.5 w-3.5 text-red-400" />
                      </Button>
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
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Template Editor"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="mb-1">Name *</Label>
                <Input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="framework">Framework</SelectItem>
                    <SelectItem value="listicle">Listicle</SelectItem>
                    <SelectItem value="contrarian">Contrarian</SelectItem>
                    <SelectItem value="case_study">Case Study</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="motivational">Motivational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1">Description</Label>
                <Input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1">Structure * (use [PLACEHOLDER] format)</Label>
                <Textarea
                  value={formStructure}
                  onChange={(e) => setFormStructure(e.target.value)}
                  rows={6}
                  className="resize-none font-mono"
                />
              </div>
              <div>
                <Label className="mb-1">Tags (comma-separated)</Label>
                <Input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="storytelling, data-driven, hooks"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving || !formName || !formStructure}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
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

      {/* Tracked Creators */}
      <TrackedCreators />

      {/* Viral Posts Section */}
      <ViralPostsSection onTemplateExtracted={fetchTemplates} />

      {/* Styles Section */}
      <StylesSection />
    </div>
  );
}
