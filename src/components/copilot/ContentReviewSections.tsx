/** ContentReviewSections. Sub-components for rendering content review sections. Constraint: Pure render, no API calls. */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Check, Pencil, X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EditableFieldProps {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  large?: boolean;
  inline?: boolean;
  multiline?: boolean;
}

interface SectionItem {
  sectionName: string;
  contents: string[];
}

export interface SectionRendererProps {
  section: SectionItem;
  sectionIdx: number;
  isExpanded: boolean;
  editingField: string | null;
  canRemove: boolean;
  normalizeItem: (item: unknown) => string;
  onToggle: (idx: number) => void;
  onStartEdit: (field: string) => void;
  onSaveField: (field: string, value: string) => void;
  onCancelEdit: () => void;
  onRemoveSection: (idx: number) => void;
  onAddItem: (sectionIdx: number) => void;
  onRemoveItem: (sectionIdx: number, itemIdx: number) => void;
}

export interface MistakesListProps {
  mistakes: string[];
  editingField: string | null;
  normalizeItem: (item: unknown) => string;
  onStartEdit: (field: string) => void;
  onSaveField: (field: string, value: string) => void;
  onCancelEdit: () => void;
}

export interface ContentMetadataProps {
  content: {
    nonObviousInsight?: string;
    personalExperience?: string;
    proof?: string;
    differentiation?: string;
  };
  editingField: string | null;
  onStartEdit: (field: string) => void;
  onSaveField: (field: string, value: string) => void;
  onCancelEdit: () => void;
}

// ─── EditableField ─────────────────────────────────────────────────────────────

export function EditableField({
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  large = false,
  inline = false,
  multiline = false,
}: EditableFieldProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (multiline) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSave(draft);
        }
      } else {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSave(draft);
        }
      }
    },
    [draft, multiline, onSave, onCancel]
  );

  if (isEditing) {
    const sharedClasses =
      'w-full rounded-md border border-ring bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

    return (
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className={`${sharedClasses} resize-y`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`${sharedClasses} ${large ? 'text-2xl font-bold' : ''}`}
          />
        )}
        <button
          onClick={() => onSave(draft)}
          className="mt-1 p-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors flex-shrink-0"
          aria-label="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="mt-1 p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const textClasses = large
    ? 'text-2xl font-bold text-foreground'
    : inline
      ? 'text-sm text-muted-foreground'
      : 'text-sm text-foreground leading-relaxed';

  return (
    <div
      className="group relative cursor-pointer rounded-md px-1 -mx-1 hover:bg-muted transition-colors"
      onClick={onStartEdit}
    >
      <span className={textClasses}>{value || '(empty)'}</span>
      <Pencil className="absolute top-1/2 -translate-y-1/2 right-1 w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
}

// ─── SectionRenderer ───────────────────────────────────────────────────────────

export function SectionRenderer({
  section,
  sectionIdx,
  isExpanded,
  editingField,
  canRemove,
  normalizeItem,
  onToggle,
  onStartEdit,
  onSaveField,
  onCancelEdit,
  onRemoveSection,
  onAddItem,
  onRemoveItem,
}: SectionRendererProps) {
  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50">
        <button
          onClick={() => onToggle(sectionIdx)}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <EditableField
            value={section.sectionName}
            isEditing={editingField === `section-name-${sectionIdx}`}
            onStartEdit={() => onStartEdit(`section-name-${sectionIdx}`)}
            onSave={(v) => onSaveField(`section-name-${sectionIdx}`, v)}
            onCancel={onCancelEdit}
            inline
          />
        </div>
        {canRemove && (
          <button
            onClick={() => onRemoveSection(sectionIdx)}
            className="p-1 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors"
            aria-label="Remove section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Section body */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-2">
          {section.contents.map((item, itemIdx) => (
            <div key={itemIdx} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <EditableField
                  value={normalizeItem(item)}
                  isEditing={editingField === `item-${sectionIdx}-${itemIdx}`}
                  onStartEdit={() => onStartEdit(`item-${sectionIdx}-${itemIdx}`)}
                  onSave={(v) => onSaveField(`item-${sectionIdx}-${itemIdx}`, v)}
                  onCancel={onCancelEdit}
                  multiline
                />
              </div>
              <button
                onClick={() => onRemoveItem(sectionIdx, itemIdx)}
                className="mt-1 p-0.5 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                aria-label="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onAddItem(sectionIdx)}
            className="flex items-center gap-1 mt-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add item
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MistakesList ──────────────────────────────────────────────────────────────

export function MistakesList({
  mistakes,
  editingField,
  normalizeItem,
  onStartEdit,
  onSaveField,
  onCancelEdit,
}: MistakesListProps) {
  if (mistakes.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Common Mistakes
      </h3>
      <div className="flex flex-wrap gap-2">
        {mistakes.map((mistake, i) => (
          <div key={i} className="group relative">
            {editingField === `mistake-${i}` ? (
              <div className="flex items-center gap-1">
                <EditableField
                  value={normalizeItem(mistake)}
                  isEditing
                  onStartEdit={() => onStartEdit(`mistake-${i}`)}
                  onSave={(v) => onSaveField(`mistake-${i}`, v)}
                  onCancel={onCancelEdit}
                  inline
                />
              </div>
            ) : (
              <span
                onClick={() => onStartEdit(`mistake-${i}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-muted text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
              >
                {normalizeItem(mistake)}
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ContentMetadata ───────────────────────────────────────────────────────────

export function ContentMetadata({
  content,
  editingField,
  onStartEdit,
  onSaveField,
  onCancelEdit,
}: ContentMetadataProps) {
  return (
    <>
      {/* Key Insight */}
      {content.nonObviousInsight && (
        <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-r-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
            Key Insight
          </p>
          <EditableField
            value={content.nonObviousInsight}
            isEditing={editingField === 'insight'}
            onStartEdit={() => onStartEdit('insight')}
            onSave={(v) => onSaveField('insight', v)}
            onCancel={onCancelEdit}
            multiline
          />
        </div>
      )}

      {/* Personal Experience */}
      {content.personalExperience && (
        <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded-r-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1">
            Personal Experience
          </p>
          <EditableField
            value={content.personalExperience}
            isEditing={editingField === 'experience'}
            onStartEdit={() => onStartEdit('experience')}
            onSave={(v) => onSaveField('experience', v)}
            onCancel={onCancelEdit}
            multiline
          />
        </div>
      )}

      {/* Proof & Results */}
      {content.proof && (
        <div className="border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 rounded-r-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1">
            Proof &amp; Results
          </p>
          <EditableField
            value={content.proof}
            isEditing={editingField === 'proof'}
            onStartEdit={() => onStartEdit('proof')}
            onSave={(v) => onSaveField('proof', v)}
            onCancel={onCancelEdit}
            multiline
          />
        </div>
      )}

      {/* Differentiation */}
      {content.differentiation && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            What Makes This Different
          </h3>
          <EditableField
            value={content.differentiation}
            isEditing={editingField === 'differentiation'}
            onStartEdit={() => onStartEdit('differentiation')}
            onSave={(v) => onSaveField('differentiation', v)}
            onCancel={onCancelEdit}
            multiline
          />
        </div>
      )}
    </>
  );
}
