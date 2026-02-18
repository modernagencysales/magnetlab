'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Check, Loader2, Sparkles, Copy, ChevronDown, ChevronUp, Pencil, Plus, X, GripVertical } from 'lucide-react';
import type { ExtractedContent } from '@/lib/types/lead-magnet';

interface ContentStepProps {
  content: ExtractedContent;
  onApprove: () => void;
  onBack: () => void;
  loading: boolean;
  onContentChange?: (content: ExtractedContent) => void;
}

// Helper to normalize items that might be strings or objects with various property names.
// The AI may return objects like {item, explanation}, {mistake, explanation}, {error, reason}, etc.
// This function handles any object by extracting the first two string values.
function normalizeItem(item: string | Record<string, unknown>): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    // Get all string values from the object
    const values = Object.values(item).filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (values.length >= 2) {
      // Two values: format as "first: second" (e.g., "mistake: explanation")
      return `${values[0]}: ${values[1]}`;
    }
    if (values.length === 1) {
      return values[0];
    }
    // No string values found, fall back to JSON
    return JSON.stringify(item);
  }
  return String(item);
}

export function ContentStep({ content, onApprove, onBack, loading, onContentChange }: ContentStepProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const updateContent = useCallback(
    (updates: Partial<ExtractedContent>) => {
      onContentChange?.({ ...content, ...updates });
    },
    [content, onContentChange]
  );

  const updateSectionName = useCallback(
    (sectionIndex: number, newName: string) => {
      const newStructure = content.structure.map((s, i) =>
        i === sectionIndex ? { ...s, sectionName: newName } : s
      );
      updateContent({ structure: newStructure });
    },
    [content.structure, updateContent]
  );

  const updateSectionItem = useCallback(
    (sectionIndex: number, itemIndex: number, newValue: string) => {
      const newStructure = content.structure.map((s, i) =>
        i === sectionIndex
          ? { ...s, contents: s.contents.map((c, j) => (j === itemIndex ? newValue : c)) }
          : s
      );
      updateContent({ structure: newStructure });
    },
    [content.structure, updateContent]
  );

  const addSectionItem = useCallback(
    (sectionIndex: number) => {
      const newStructure = content.structure.map((s, i) =>
        i === sectionIndex ? { ...s, contents: [...s.contents, ''] } : s
      );
      updateContent({ structure: newStructure });
      setEditingField(`structure-${sectionIndex}-${content.structure[sectionIndex].contents.length}`);
    },
    [content.structure, updateContent]
  );

  const removeSectionItem = useCallback(
    (sectionIndex: number, itemIndex: number) => {
      const newStructure = content.structure.map((s, i) =>
        i === sectionIndex
          ? { ...s, contents: s.contents.filter((_, j) => j !== itemIndex) }
          : s
      );
      updateContent({ structure: newStructure });
    },
    [content.structure, updateContent]
  );

  const addSection = useCallback(() => {
    const newStructure = [...content.structure, { sectionName: '', contents: [''] }];
    updateContent({ structure: newStructure });
    setEditingField(`section-name-${content.structure.length}`);
  }, [content.structure, updateContent]);

  const removeSection = useCallback(
    (sectionIndex: number) => {
      if (content.structure.length <= 1) return;
      const newStructure = content.structure.filter((_, i) => i !== sectionIndex);
      updateContent({ structure: newStructure });
    },
    [content.structure, updateContent]
  );

  // Generate the full lead magnet document text
  const generateFullContent = () => {
    let text = `# ${content.title}\n\n`;
    text += `*Format: ${content.format}*\n\n`;
    text += `---\n\n`;
    text += `## Key Insight\n\n${content.nonObviousInsight}\n\n`;

    content.structure.forEach((section) => {
      text += `## ${section.sectionName}\n\n`;
      section.contents.forEach((item) => {
        text += `- ${normalizeItem(item)}\n`;
      });
      text += '\n';
    });

    if (content.personalExperience) {
      text += `## Personal Experience\n\n${content.personalExperience}\n\n`;
    }

    text += `## Proof & Results\n\n${content.proof}\n\n`;

    if (content.commonMistakes.length > 0) {
      text += `## Common Mistakes This Prevents\n\n`;
      content.commonMistakes.forEach((mistake) => {
        text += `- ${normalizeItem(mistake)}\n`;
      });
      text += '\n';
    }

    text += `## What Makes This Different\n\n${content.differentiation}\n`;

    return text;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateFullContent());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generateFullContent();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Lead Magnet</h1>
          <p className="mt-2 text-muted-foreground">
            Here&apos;s the structured content we created from your expertise.
            Review and approve to generate your LinkedIn post.
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold">{content.title}</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            Format: {content.format}
          </div>
        </div>

        {/* Key Insight */}
        <div className="rounded-lg bg-primary/10 p-4">
          <div className="mb-1 text-sm font-medium text-primary">Key Insight</div>
          <p>{content.nonObviousInsight}</p>
        </div>

        {/* Sections (Framework / Formula) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Framework / Steps</div>
            {onContentChange && (
              <button
                type="button"
                onClick={() => setEditingField(editingField?.startsWith('structure') || editingField?.startsWith('section') ? null : 'structure')}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                {editingField?.startsWith('structure') || editingField?.startsWith('section') ? 'Done' : 'Edit'}
              </button>
            )}
          </div>
          {content.structure.map((section, index) => (
            <div key={index} className="group relative">
              {editingField?.startsWith('structure') || editingField?.startsWith('section') ? (
                <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <input
                      type="text"
                      value={section.sectionName}
                      onChange={(e) => updateSectionName(index, e.target.value)}
                      placeholder="Section name..."
                      className="flex-1 bg-transparent font-semibold outline-none placeholder:text-muted-foreground/50 focus:ring-0"
                      autoFocus={editingField === `section-name-${index}`}
                    />
                    {content.structure.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove section"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1.5 pl-6">
                    {section.contents.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2">
                        <Check className="mt-2 h-4 w-4 shrink-0 text-primary" />
                        <input
                          type="text"
                          value={typeof item === 'string' ? item : normalizeItem(item)}
                          onChange={(e) => updateSectionItem(index, itemIndex, e.target.value)}
                          placeholder="Add a step or point..."
                          className="flex-1 rounded border-0 bg-secondary/50 px-2 py-1 text-sm outline-none focus:bg-secondary focus:ring-1 focus:ring-primary/30"
                          autoFocus={editingField === `structure-${index}-${itemIndex}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSectionItem(index, itemIndex)}
                          className="mt-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Remove item"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => addSectionItem(index)}
                    className="ml-6 flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add item
                  </button>
                </div>
              ) : (
                <div>
                  <h3 className="mb-2 font-semibold">{section.sectionName}</h3>
                  <ul className="space-y-1">
                    {section.contents.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{normalizeItem(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {(editingField?.startsWith('structure') || editingField?.startsWith('section')) && (
            <button
              type="button"
              onClick={addSection}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add section
            </button>
          )}
        </div>

        {/* Personal Experience */}
        {content.personalExperience && (
          <div className="rounded-lg bg-blue-500/10 p-4">
            <div className="mb-1 text-sm font-medium text-blue-600">Personal Experience</div>
            <p className="text-sm">{content.personalExperience}</p>
          </div>
        )}

        {/* Proof & Results */}
        <div className="rounded-lg bg-green-500/10 p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-medium text-green-600">Proof & Results</div>
            {onContentChange && (
              <button
                type="button"
                onClick={() => setEditingField(editingField === 'proof' ? null : 'proof')}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-green-500/10 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                {editingField === 'proof' ? 'Done' : 'Edit'}
              </button>
            )}
          </div>
          {editingField === 'proof' ? (
            <textarea
              value={content.proof}
              onChange={(e) => updateContent({ proof: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-green-300/30 bg-white/50 px-3 py-2 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400/30 dark:bg-black/20"
              placeholder="Describe your results, metrics, case studies..."
              autoFocus
            />
          ) : (
            <p className="text-sm">{content.proof}</p>
          )}
        </div>

        {/* Common Mistakes */}
        {content.commonMistakes.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">Common Mistakes This Prevents</div>
            <div className="flex flex-wrap gap-2">
              {content.commonMistakes.map((mistake, index) => (
                <span
                  key={index}
                  className="rounded-full bg-destructive/10 px-3 py-1 text-sm text-destructive dark:text-red-400"
                >
                  {normalizeItem(mistake)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Differentiation */}
        <div className="border-t pt-4">
          <div className="mb-1 text-sm font-medium">What Makes This Different</div>
          <p className="text-sm text-muted-foreground">{content.differentiation}</p>
        </div>
      </div>

      {/* Full Content Preview (expandable) */}
      <div className="rounded-xl border bg-card">
        <button
          onClick={() => setShowFullContent(!showFullContent)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <span className="font-medium">View Full Content (Copy/Paste Ready)</span>
          {showFullContent ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {showFullContent && (
          <div className="border-t">
            <div className="flex justify-end border-b p-2">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy All
                  </>
                )}
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {generateFullContent()}
              </pre>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onApprove}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating LinkedIn posts...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Approve & Generate LinkedIn Post
          </>
        )}
      </button>
    </div>
  );
}
